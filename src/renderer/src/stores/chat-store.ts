import { create } from 'zustand'
import type { AgentStreamEnvelope, TokenUsageWire, RequestTimingWire } from '@shared/agent-stream-protocol'
import { getAgentStreamReceiver } from '@renderer/lib/ipc/agent-stream-receiver'
import { isChatStreamEvent } from '@renderer/lib/agent/stream-event-adapter'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  thinking?: string
  isStreaming?: boolean
  usage?: TokenUsageWire
  timing?: RequestTimingWire
  error?: string
  createdAt: number
}

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  currentRunId: string | null
  error: string | null

  sendMessage: (params: {
    provider: Record<string, unknown>
    messages: Array<{ role: string; content: string }>
    sessionId?: string
    systemPrompt?: string
  }) => Promise<void>
  cancelStream: () => Promise<void>
  clearMessages: () => void
  handleEnvelope: (envelope: AgentStreamEnvelope) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentRunId: null,
  error: null,

  sendMessage: async (params) => {
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: params.messages[params.messages.length - 1]?.content ?? '',
      createdAt: Date.now()
    }

    const assistantMessage: ChatMessage = {
      id: `assistant_${Date.now()}`,
      role: 'assistant',
      text: '',
      thinking: '',
      isStreaming: true,
      createdAt: Date.now()
    }

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isStreaming: true,
      error: null
    }))

    try {
      const result = await window.api.workerRequest<{ started: boolean; runId: string }>(
        'agent/run',
        params
      )

      if (result.started) {
        set({ currentRunId: result.runId })
      } else {
        set({ isStreaming: false, error: 'Failed to start agent run' })
      }
    } catch (err) {
      set({
        isStreaming: false,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  },

  cancelStream: async () => {
    const runId = get().currentRunId
    if (!runId) return

    try {
      await window.api.workerRequest('agent/cancel', { runId })
    } catch {
      // ignore
    }

    set((state) => ({
      isStreaming: false,
      currentRunId: null,
      messages: state.messages.map((m) =>
        m.isStreaming ? { ...m, isStreaming: false, text: m.text || '[cancelled]' } : m
      )
    }))
  },

  clearMessages: () => {
    set({ messages: [], error: null, currentRunId: null, isStreaming: false })
  },

  handleEnvelope: (envelope) => {
    if (get().currentRunId !== envelope.runId) return

    for (const event of envelope.events) {
      if (!isChatStreamEvent(event)) continue

      switch (event.type) {
        case 'text_delta':
          set((state) => ({
            messages: state.messages.map((m) =>
              m.isStreaming ? { ...m, text: m.text + event.text } : m
            )
          }))
          break

        case 'thinking_delta':
          set((state) => ({
            messages: state.messages.map((m) =>
              m.isStreaming ? { ...m, thinking: (m.thinking ?? '') + event.thinking } : m
            )
          }))
          break

        case 'message_end':
          set((state) => ({
            messages: state.messages.map((m) =>
              m.isStreaming
                ? {
                    ...m,
                    isStreaming: false,
                    usage: event.usage,
                    timing: event.timing
                  }
                : m
            )
          }))
          break

        case 'loop_end':
          set((state) => ({
            isStreaming: false,
            currentRunId: null,
            messages: state.messages.map((m) =>
              m.isStreaming ? { ...m, isStreaming: false } : m
            )
          }))
          break

        case 'error':
          set((state) => ({
            isStreaming: false,
            currentRunId: null,
            error: event.message,
            messages: state.messages.map((m) =>
              m.isStreaming
                ? { ...m, isStreaming: false, error: event.message }
                : m
            )
          }))
          break
      }
    }
  }
}))

// Start the stream receiver
getAgentStreamReceiver().start((envelope) => {
  useChatStore.getState().handleEnvelope(envelope)
})
