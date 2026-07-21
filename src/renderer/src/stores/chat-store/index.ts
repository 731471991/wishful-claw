import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { AgentStreamEnvelope } from '@shared/agent-stream-protocol'
import { getAgentStreamReceiver } from '@renderer/lib/ipc/agent-stream-receiver'
import { isChatStreamEvent } from '@renderer/lib/agent/stream-event-adapter'
import { createSessionSlice, type SessionSlice } from './session-slice'
import { createProjectSlice, type ProjectSlice } from './project-slice'
import { createStreamingSlice, type StreamingSlice } from './streaming-slice'
import type { ChatMessage } from './types'

export type { Session, Project, ChatMessage, SessionMode, CreateSessionOptions, SessionPromptSnapshot } from './types'
export type { SessionSlice } from './session-slice'
export type { ProjectSlice } from './project-slice'
export type { StreamingSlice } from './streaming-slice'

// ─── Agent Actions (sendMessage / cancelStream / handleEnvelope) ───

export interface AgentActions {
  sendMessage: (params: {
    provider: Record<string, unknown>
    messages: Array<{ role: string; content: string }>
    sessionId?: string
    systemPrompt?: string
  }) => Promise<void>
  cancelStream: () => Promise<void>
  handleEnvelope: (envelope: AgentStreamEnvelope) => void
}

export type ChatStore = SessionSlice & ProjectSlice & StreamingSlice & AgentActions

// Use immer middleware so set((state) => { state.x = y }) works
export const useChatStore = create<ChatStore>()(
  immer((...args) => ({
    ...createSessionSlice(...args as Parameters<typeof createSessionSlice>),
    ...createProjectSlice(...args as Parameters<typeof createProjectSlice>),
    ...createStreamingSlice(...args as Parameters<typeof createStreamingSlice>),

    // ─── Agent Actions ───
    sendMessage: async (params) => {
      const get = args[1] as () => ChatStore
      const state = get()
      const sessionId = params.sessionId ?? state.activeSessionId
      if (!sessionId) return

      const userText = params.messages[params.messages.length - 1]?.content ?? ''
      const now = Date.now()
      const userMessage: ChatMessage = {
        id: `user_${now}`,
        role: 'user',
        text: userText,
        createdAt: now
      }
      const assistantMessage: ChatMessage = {
        id: `assistant_${now}`,
        role: 'assistant',
        text: '',
        thinking: '',
        isStreaming: true,
        createdAt: now
      }

      // Add messages to session
      state.beginUserTurn(sessionId, userMessage, assistantMessage, assistantMessage.id)

      // Auto-generate title from first user message
      const session = state.sessions.find((s) => s.id === sessionId)
      if (session && session.title === 'New Conversation' && userText) {
        state.updateSessionTitle(sessionId, userText.slice(0, 40) + (userText.length > 40 ? '...' : ''))
      }

      try {
        const result = await window.api.workerRequest<{ started: boolean; runId: string }>(
          'agent/run',
          params
        )
        if (result.started) {
          state.setStreamingMessageId(sessionId, result.runId)
        }
      } catch (err) {
        state.updateMessage(sessionId, assistantMessage.id, {
          isStreaming: false,
          error: err instanceof Error ? err.message : String(err)
        })
      }
    },

    cancelStream: async () => {
      const get = args[1] as () => ChatStore
      const state = get()
      const runId = state.streamingMessageId
      if (!runId) return

      try {
        await window.api.workerRequest('agent/cancel', { runId })
      } catch {
        // ignore
      }

      const sessionId = state.activeSessionId
      if (sessionId) {
        state.setStreamingMessageId(sessionId, null)
      }

      // Mark streaming messages as no longer streaming
      const session = state.sessions.find((s) => s.id === sessionId)
      if (session) {
        for (const msg of session.messages) {
          if (msg.isStreaming) {
            state.updateMessage(sessionId!, msg.id, {
              isStreaming: false,
              text: msg.text || '[cancelled]'
            })
          }
        }
      }
    },

    handleEnvelope: (envelope) => {
      const get = args[1] as () => ChatStore
      const state = get()

      // Find the session that has this runId as its streaming message
      let targetSessionId: string | null = null
      for (const [sid, msgId] of Object.entries(state.streamingMessages)) {
        if (msgId === envelope.runId) {
          targetSessionId = sid
          break
        }
      }
      if (!targetSessionId) return

      for (const event of envelope.events) {
        if (!isChatStreamEvent(event)) continue

        switch (event.type) {
          case 'text_delta':
            state.appendTextDelta(targetSessionId, envelope.runId, event.text)
            break

          case 'thinking_delta':
            state.appendThinkingDelta(targetSessionId, envelope.runId, event.thinking)
            break

          case 'message_end':
            state.updateMessage(targetSessionId, envelope.runId, {
              isStreaming: false,
              usage: event.usage,
              timing: event.timing
            })
            break

          case 'loop_end':
            state.setStreamingMessageId(targetSessionId, null)
            {
              const session = state.sessions.find((s) => s.id === targetSessionId)
              if (session) {
                for (const msg of session.messages) {
                  if (msg.isStreaming) {
                    state.updateMessage(targetSessionId!, msg.id, { isStreaming: false })
                  }
                }
              }
            }
            break

          case 'error':
            state.setStreamingMessageId(targetSessionId, null)
            state.updateMessage(targetSessionId, envelope.runId, {
              isStreaming: false,
              error: event.message
            })
            break
        }
      }
    }
  }))
)

// Start the stream receiver
getAgentStreamReceiver().start((envelope) => {
  useChatStore.getState().handleEnvelope(envelope)
})
