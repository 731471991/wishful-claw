// Stub: pet-agent-store (to be filled when pet features are migrated)

export type PetVoiceMode = 'off' | 'always' | 'voice-only' | 'on-demand' | 'auto' | 'chat' | 'speech'

export const PET_PROACTIVE_DAILY_CAP = 20

export function isInQuietHours(_now?: Date): boolean {
  return false
}

interface PetAgentState {
  voiceEnabled?: boolean
  voiceProviderId?: string
  voiceModelId?: string
  voice?: string
  voiceMode?: PetVoiceMode
  voiceInstruction?: string
  voiceTag?: string
  providerId?: string
  modelId?: string
  systemPrompt?: string
  projectName?: string
  projectFolder?: string
  [key: string]: unknown
}

export const usePetAgentStoreStore = {
  getState: (): PetAgentState => ({}),
  subscribe: () => () => {},
}

// Alias for compatibility with pet-voice.ts
export const usePetAgentStore = usePetAgentStoreStore
