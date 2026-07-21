import type { StateCreator } from 'zustand'
import type { SessionSlice } from './session-slice'
import type { ProjectSlice as _ProjectSlice } from './project-slice'

export interface ImageGenerationTiming {
  startedAt: number
  completedAt?: number
}

interface StreamingSliceState {
  streamingMessageId: string | null
  streamingMessages: Record<string, string>
  generatingImageMessages: Record<string, boolean>
  imageGenerationTimings: Record<string, ImageGenerationTiming>

  setStreamingMessageId: (sessionId: string, id: string | null) => void
  setGeneratingImage: (msgId: string, generating: boolean, occurredAt?: number) => void
}

export type StreamingSlice = StreamingSliceState

export const createStreamingSlice: StateCreator<
  SessionSlice & StreamingSliceState,
  [['zustand/immer', never]],
  [],
  StreamingSliceState
> = (set, get) => ({
  streamingMessageId: null,
  streamingMessages: {},
  generatingImageMessages: {},
  imageGenerationTimings: {},

  setStreamingMessageId: (sessionId, id) => {
    set((state) => {
      if (id) {
        state.streamingMessages[sessionId] = id
      } else {
        delete state.streamingMessages[sessionId]
      }
      if (sessionId === state.activeSessionId) {
        state.streamingMessageId = id
      }
    })
    // Sync streamingMessageId with active session
    void get
  },

  setGeneratingImage: (msgId, generating, occurredAt) => {
    set((state) => {
      if (generating) {
        state.generatingImageMessages[msgId] = true
        state.imageGenerationTimings[msgId] = { startedAt: occurredAt ?? Date.now() }
      } else {
        delete state.generatingImageMessages[msgId]
        const timing = state.imageGenerationTimings[msgId]
        if (timing) {
          timing.completedAt = Date.now()
        }
      }
    })
  }
})
