import { agentBridge } from '@renderer/lib/ipc/agent-bridge'
import { ensureProviderAuthReady } from '@renderer/lib/auth/provider-auth'
import { useProviderStore } from '@renderer/stores/provider-store'
import { usePetAgentStore, type PetVoiceMode } from '@renderer/stores/pet-agent-store'

/**
 * Voice playback for the pet's AI speech. Synthesis runs in the native
 * worker ('openai-audio/speech') and supports two transports:
 * - 'speech': classic OpenAI POST /audio/speech (tts-1, gpt-4o-mini-tts…)
 * - 'chat':   chat/completions with an audio-capable model (Xiaomi MiMo
 *             mimo-v2.5-tts, OpenAI gpt-4o-audio…), audio as base64.
 *
 * Streamed replies speak sentence-by-sentence (createPetSpeechSession):
 * each completed sentence is synthesized while the rest is still being
 * generated, so audio starts roughly in sync with the text.
 */

export const SPEECH_TIMEOUT_MS = 120_000
export const MAX_SPEECH_CHARS = 400
const SENTENCE_BOUNDARY = /[。！？!?；;…~～\n]/
/** Softer pause marks the opening segment may cut at for a faster start. */
const PAUSE_BOUNDARY = /[，,、]/
/** pcm16 sample rate used by MiMo and OpenAI chat-audio streams. */
export const PCM_SAMPLE_RATE = 24_000

export const PET_VOICE_PRESETS: Record<'openai' | 'mimo', string[]> = {
  openai: [
    'alloy',
    'ash',
    'ballad',
    'coral',
    'echo',
    'fable',
    'onyx',
    'nova',
    'sage',
    'shimmer',
    'verse'
  ],
  mimo: ['mimo_default', '冰糖', '茉莉', '苏打', '白桦', 'Mia', 'Chloe', 'Milo', 'Dean']
}

export function resolvePetVoiceMode(modelId: string, mode: PetVoiceMode): PetVoiceMode {
  if (mode !== 'auto') return mode
  // Chat-audio models speak through completions; plain TTS models through
  // the dedicated speech endpoint.
  return /mimo|-audio/i.test(modelId) ? 'chat' : 'speech'
}

export interface PetVoiceParams {
  providerId: string
  modelId: string
  voice: string
  mode: PetVoiceMode
  instruction: string
  /** MiMo `(tag)` prefix — dialect/emotion, e.g. 粤语、撒娇. Empty = off. */
  tag: string
}

/**
 * MiMo reads a leading `(tag)` as a style directive (dialect, emotion,
 * singing…). Other models would speak the tag aloud, so it only applies to
 * MiMo model ids. User input may already carry brackets — normalize them.
 */
export function applyMimoTag(params: PetVoiceParams, input: string): string {
  if (!/mimo/i.test(params.modelId)) return input
  const tag = params.tag.replace(/^[（(["'\s]+|[）)\]"'\s]+$/g, '').trim()
  return tag ? `(${tag})${input}` : input
}

export interface SpeechClip {
  chunks: Uint8Array[]
  mediaType: string
}

export const _voiceState = {
  activeStreamRequestId: null as string | null,
  audioContext: null as AudioContext | null,
  currentAudio: null as HTMLAudioElement | null,
  currentAudioUrl: null as string | null,
  streamSources: [] as AudioBufferSourceNode[]
}



import { stopPetSpeech, playClip, streamAndPlay, synthesizeClip } from './pet-voice-audio'

const streamUnsupported = new Set<string>()

/**
 * Speak one text and resolve when playback ends. Chat-audio models stream
 * (first sound within ~a second); on stream failure, and for /audio/speech
 * models, fall back to whole-clip synthesis.
 */
async function speakOne(params: PetVoiceParams, text: string): Promise<void> {
  const mode = resolvePetVoiceMode(params.modelId, params.mode)
  const streamKey = `${params.providerId}::${params.modelId}`
  const startedAt = performance.now()
  if (mode === 'chat' && !streamUnsupported.has(streamKey)) {
    try {
      await streamAndPlay(params, text)
      return
    } catch (error) {
      streamUnsupported.add(streamKey)
      console.warn('[Pet][voice] streaming TTS failed, falling back to non-streaming:', error)
    }
  }
  const clip = await synthesizeClip(params, text)
  console.info(
    `[Pet][voice] clip synthesized in ${Math.round(performance.now() - startedAt)}ms (${text.length} chars)`
  )
  await playClip(clip)
}

/** Synthesize and fully play one text; throws on failure (settings test). */
export async function playPetVoice(params: PetVoiceParams, text: string): Promise<void> {
  await speakOne(params, text)
}

function voiceParamsFromConfig(): PetVoiceParams | null {
  const config = usePetAgentStore.getState()
  if (!config.voiceEnabled || !config.voiceProviderId || !config.voiceModelId) return null
  return {
    providerId: config.voiceProviderId!,
    modelId: config.voiceModelId!,
    voice: config.voice ?? '',
    mode: config.voiceMode ?? 'speech',
    instruction: config.voiceInstruction ?? '',
    tag: config.voiceTag ?? ''
  }
}

/** Speak a complete text using the saved config; silent on any failure. */
export async function speakPetText(text: string): Promise<void> {
  const params = voiceParamsFromConfig()
  if (!params) return
  try {
    await speakOne(params, text)
  } catch (error) {
    console.error('[Pet] speech synthesis failed:', error)
  }
}

/** Index just past the last sentence boundary in the text, or 0. */
function lastSentenceBoundary(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) {
    if (SENTENCE_BOUNDARY.test(text[i])) return i + 1
  }
  return 0
}

/**
 * Cut for the OPENING segment: the earliest boundary, and commas count once
 * a few characters exist — the first sound should start as soon as possible,
 * even mid-sentence. Pet replies often end in "~" with no full stop at all.
 */
function firstSegmentCut(text: string): number {
  for (let i = 0; i < text.length; i++) {
    if (SENTENCE_BOUNDARY.test(text[i])) return i + 1
    if (i >= 5 && PAUSE_BOUNDARY.test(text[i])) return i + 1
  }
  return 0
}

export interface PetSpeechSession {
  /** Feed the cumulative (cleaned) streamed text; speaks finished sentences. */
  feed: (cumulativeText: string) => void
  /** Flush the trailing sentence once the reply is complete. */
  finish: (finalText: string) => void
  cancel: () => void
}

let sessionCounter = 0
let activeSessionId = 0

/**
 * Sentence-streaming speech for a streamed reply: sentences are synthesized
 * as soon as they complete (concurrently with generation) and played back
 * strictly in order. Returns null when voice is disabled/unconfigured.
 */
export function createPetSpeechSession(): PetSpeechSession | null {
  const params = voiceParamsFromConfig()
  if (!params) return null

  const id = ++sessionCounter
  activeSessionId = id
  const queue: string[] = []
  let committed = ''
  let playing = false
  let done = false

  const pump = async (): Promise<void> => {
    if (playing) return
    playing = true
    try {
      while (queue.length > 0) {
        if (activeSessionId !== id) return
        const text = queue.shift()!
        try {
          await speakOne(params, text)
        } catch (error) {
          console.error('[Pet] speech synthesis failed:', error)
        }
      }
    } finally {
      playing = false
    }
  }

  const enqueue = (text: string): void => {
    const trimmed = text.trim()
    if (!trimmed) return
    queue.push(trimmed)
    void pump()
  }

  const feed = (cumulativeText: string): void => {
    if (done || activeSessionId !== id) return
    // Streamed text should only grow; if it was rewritten (think-tag
    // stripping edge cases), wait for finish() to settle things.
    if (!cumulativeText.startsWith(committed)) return
    const pending = cumulativeText.slice(committed.length)
    // Opening segment cuts aggressively (first pause mark) so speech starts
    // as early as possible; later segments batch whole sentences.
    const cut = committed === '' ? firstSegmentCut(pending) : lastSentenceBoundary(pending)
    if (cut > 0) {
      enqueue(pending.slice(0, cut))
      committed = cumulativeText.slice(0, committed.length + cut)
    }
  }

  const finish = (finalText: string): void => {
    if (done || activeSessionId !== id) return
    done = true
    if (finalText.startsWith(committed)) {
      enqueue(finalText.slice(committed.length))
    } else if (!committed) {
      enqueue(finalText)
    }
    // Mismatch after sentences were already spoken: skip the tail rather
    // than repeating the whole reply.
  }

  const cancel = (): void => {
    done = true
    if (activeSessionId === id) {
      activeSessionId = 0
      stopPetSpeech()
    }
  }

  return { feed, finish, cancel }
}

/** Whether the app-wide speech recognition model is configured. */
export function isVoiceInputConfigured(): boolean {
  const store = useProviderStore.getState()
  return !!store.activeSpeechProviderId && !!store.activeSpeechModelId
}

/**
 * Transcribe recorded voice input with the app's speech recognition model
 * (Settings → Model → Speech recognition) via the native worker.
 */
export async function transcribeVoiceInput(base64: string, mediaType: string): Promise<string> {
  const store = useProviderStore.getState()
  const providerId = store.activeSpeechProviderId
  if (!providerId) throw new Error('speech recognition model is not configured')
  await ensureProviderAuthReady(providerId)
  const config = store.getSpeechProviderConfig()
  if (!config) throw new Error('speech recognition model is not configured')
  if (!(await agentBridge.initialize())) {
    throw new Error('native worker unavailable for transcription')
  }

  const result = (await agentBridge.request(
    'openai-audio/transcribe',
    {
      provider: config,
      file: { base64, mediaType, fileName: 'voice-input.webm' }
    },
    SPEECH_TIMEOUT_MS
  )) as { text?: string } | null
  return result?.text?.trim() ?? ''
}
