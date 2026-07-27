import { nanoid } from 'nanoid'
import { agentBridge } from '@renderer/lib/ipc/agent-bridge'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
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


export function getAudioContext(): AudioContext {
  if (!audioContext) audioContext = new AudioContext()
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

export function stopStreamingPlayback(): void {
  for (const source of streamSources) {
    try {
      source.stop()
    } catch {
      // already stopped
    }
  }
  streamSources = []
  if (activeStreamRequestId) {
    void ipcClient.invoke('pet:tts-cancel', { requestId: activeStreamRequestId })
    activeStreamRequestId = null
  }
}

export function stopPetSpeech(): void {
  currentAudio?.pause()
  currentAudio = null
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl)
    currentAudioUrl = null
  }
  stopStreamingPlayback()
}

async function synthesizeClip(params: PetVoiceParams, text: string): Promise<SpeechClip> {
  const normalized = text.replace(/\s+/g, ' ').trim().slice(0, MAX_SPEECH_CHARS)
  if (!normalized) throw new Error('empty speech text')
  const input = applyMimoTag(params, normalized)

  await ensureProviderAuthReady(params.providerId)
  const provider = useProviderStore
    .getState()
    .getProviderConfigById(params.providerId, params.modelId)
  if (!provider) throw new Error('pet voice model is not configured')
  if (!(await agentBridge.initialize())) {
    throw new Error('native worker unavailable for speech synthesis')
  }

  const mode = resolvePetVoiceMode(params.modelId, params.mode)
  const result = (await agentBridge.request(
    'openai-audio/speech',
    {
      provider,
      input,
      // The OpenAI speech endpoint requires a voice; chat-audio endpoints
      // fall back to their own default when omitted.
      voice: params.voice.trim() || (mode === 'speech' ? 'alloy' : ''),
      instruction: params.instruction.trim(),
      mode,
      // Chat-mode message shape: MiMo speaks the assistant message verbatim;
      // OpenAI audio models need a read-aloud instruction in a user message.
      chatStyle: /mimo/i.test(params.modelId) ? 'assistant' : 'instruct'
    },
    SPEECH_TIMEOUT_MS
  )) as {
    base64?: string
    mediaType?: string
    filePath?: string
    bytes?: number
    message?: string
    error?: string
  } | null
  if (result?.filePath) {
    return {
      chunks: await readSpeechFileChunks(result.filePath, result.bytes),
      mediaType: result.mediaType ?? 'audio/mpeg'
    }
  }
  if (!result?.base64) {
    // Surface the worker's own error text when present (e.g. an outdated
    // native worker without the speech route, or an upstream API error).
    throw new Error(result?.message || result?.error || 'speech synthesis returned no audio')
  }
  return {
    chunks: [decodeBase64Chunk(result.base64)],
    mediaType: result.mediaType ?? 'audio/mpeg'
  }
}

export function decodeBase64Chunk(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function readSpeechFileChunks(filePath: string, expectedBytes?: number): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = []
  let offset = 0
  let total = 0
  for (let page = 0; page < 512; page += 1) {
    const chunk = (await agentBridge.request(
      'media/read-file-chunk',
      { filePath, offset, length: 256 * 1024, deleteWhenDone: true },
      SPEECH_TIMEOUT_MS
    )) as { data?: string; nextOffset?: number; done?: boolean; bytes?: number } | null
    if (!chunk?.data && chunk?.done !== true) {
      throw new Error('speech audio chunk read returned no data')
    }

    const bytes = decodeBase64Chunk(chunk.data ?? '')
    chunks.push(bytes)
    total += bytes.byteLength
    if (total > 64 * 1024 * 1024) {
      throw new Error('speech audio exceeds the 64 MiB playback limit')
    }
    if (chunk.done === true) {
      if (typeof expectedBytes === 'number' && expectedBytes >= 0 && total !== expectedBytes) {
        throw new Error(`speech audio size mismatch: expected ${expectedBytes}, received ${total}`)
      }
      return chunks
    }
    if (typeof chunk.nextOffset !== 'number' || chunk.nextOffset <= offset) {
      throw new Error('speech audio chunk cursor did not advance')
    }
    offset = chunk.nextOffset
  }

  throw new Error('speech audio exceeded the chunk page safety limit')
}

/** Play one clip; resolves when playback ends or is interrupted. */
async function playClip(clip: SpeechClip): Promise<void> {
  stopPetSpeech()
  // Blob URL instead of a data: URL — WAV clips are megabytes of base64,
  // and the CSP media-src allows blob: playback.
  const url = URL.createObjectURL(
    new Blob(clip.chunks as BlobPart[], { type: clip.mediaType })
  )
  const audio = new Audio(url)
  currentAudio = audio
  currentAudioUrl = url

  await new Promise<void>((resolve) => {
    const settle = (): void => {
      if (currentAudio === audio) currentAudio = null
      if (currentAudioUrl === url) {
        URL.revokeObjectURL(url)
        currentAudioUrl = null
      }
      resolve()
    }
    // 'pause' also fires when stopPetSpeech interrupts this clip, so a
    // queued session never hangs on an interrupted take.
    audio.addEventListener('ended', settle, { once: true })
    audio.addEventListener('error', settle, { once: true })
    audio.addEventListener('pause', settle, { once: true })
    audio.play().catch(settle)
  })
}

/**
 * Streamed chat-audio synthesis (stream: true, pcm16): the main process
 * forwards SSE audio deltas as they arrive and playback starts on the first
 * chunk instead of after the full clip. Resolves when playback finishes.
 */
async function streamAndPlay(params: PetVoiceParams, text: string): Promise<void> {
  const normalized = text.replace(/\s+/g, ' ').trim().slice(0, MAX_SPEECH_CHARS)
  if (!normalized) return
  const input = applyMimoTag(params, normalized)

  await ensureProviderAuthReady(params.providerId)
  const provider = useProviderStore
    .getState()
    .getProviderConfigById(params.providerId, params.modelId)
  if (!provider) throw new Error('pet voice model is not configured')

  stopPetSpeech()
  const requestId = nanoid()
  activeStreamRequestId = requestId
  const ctx = getAudioContext()
  const startedAt = performance.now()
  let nextTime = 0
  let received = false

  const scheduleChunk = (base64: string): void => {
    const binary = atob(base64)
    const sampleCount = Math.floor(binary.length / 2)
    if (sampleCount === 0) return
    // pcm16 little-endian mono → float32
    const samples = new Float32Array(sampleCount)
    for (let i = 0; i < sampleCount; i++) {
      let value = (binary.charCodeAt(i * 2 + 1) << 8) | binary.charCodeAt(i * 2)
      if (value >= 0x8000) value -= 0x10000
      samples[i] = value / 32768
    }
    const buffer = ctx.createBuffer(1, sampleCount, PCM_SAMPLE_RATE)
    buffer.copyToChannel(samples, 0)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    const startAt = Math.max(ctx.currentTime + 0.08, nextTime)
    source.start(startAt)
    nextTime = startAt + buffer.duration
    streamSources.push(source)
    source.onended = () => {
      streamSources = streamSources.filter((item) => item !== source)
    }
  }

  const unsubscribe = ipcClient.on('pet:tts-stream-event', (payload) => {
    const event = payload as { requestId?: string; type?: string; data?: string } | null
    if (!event || event.requestId !== requestId) return
    if (event.type === 'chunk' && event.data && activeStreamRequestId === requestId) {
      if (!received) {
        console.info(
          `[Pet][voice] first stream chunk after ${Math.round(performance.now() - startedAt)}ms`
        )
      }
      received = true
      scheduleChunk(event.data)
    }
  })

  try {
    const mode = resolvePetVoiceMode(params.modelId, params.mode)
    await ipcClient.invoke('pet:tts-stream', {
      requestId,
      provider,
      input,
      voice: params.voice.trim() || (mode === 'speech' ? 'alloy' : ''),
      instruction: params.instruction.trim(),
      chatStyle: /mimo/i.test(params.modelId) ? 'assistant' : 'instruct'
    })
    if (!received) throw new Error('speech stream returned no audio')
    // Wait for the scheduled tail to finish playing.
    const remaining = nextTime - ctx.currentTime
    if (remaining > 0 && activeStreamRequestId === requestId) {
      await new Promise((resolve) => setTimeout(resolve, remaining * 1000 + 120))
    }
  } finally {
    unsubscribe()
    if (activeStreamRequestId === requestId) activeStreamRequestId = null
  }
}

/** Models whose endpoint rejected streaming — skip the doomed attempt. */
