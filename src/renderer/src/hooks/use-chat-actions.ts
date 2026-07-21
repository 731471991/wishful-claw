import { useCallback } from 'react'
import { useChatStore } from '@renderer/stores/chat-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useActivityStore } from '@renderer/stores/activity-store'

export interface SendMessageOptions {
  clearCompletedTasksOnTurnStart?: boolean
}

export function useChatActions() {
  const sendMessage = useChatStore((s) => s.sendMessage)
  const cancelStream = useChatStore((s) => s.cancelStream)

  const handleSendMessage = useCallback(
    async (text: string, _images?: unknown[], _options?: unknown, sessionId?: string, _planId?: string, _workingFolder?: string, opts?: SendMessageOptions) => {
      const provider = useUIStore.getState().selectedProvider
      if (!provider) {
        console.error('[ChatActions] No provider selected')
        return
      }

      const chatStore = useChatStore.getState()
      const targetSessionId = sessionId ?? chatStore.activeSessionId
      if (!targetSessionId) {
        console.error('[ChatActions] No active session')
        return
      }

      // Clear activities for new turn
      useActivityStore.getState().clearActivities()

      // Build messages from session history
      const session = chatStore.sessions.find((s) => s.id === targetSessionId)
      const historyMessages = (session?.messages ?? [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .filter((m) => !m.isStreaming)
        .map((m) => ({ role: m.role, content: m.text }))

      await sendMessage({
        provider,
        messages: [...historyMessages, { role: 'user', content: text }],
        sessionId: targetSessionId
      })

      void opts
    },
    [sendMessage]
  )

  const stopStreaming = useCallback(async () => {
    await cancelStream()
  }, [cancelStream])

  return {
    sendMessage: handleSendMessage,
    stopStreaming
  }
}

export function abortSession(sessionId: string): void {
  const store = useChatStore.getState()
  store.setStreamingMessageId(sessionId, null)
}

export function clearPendingSessionMessages(sessionId: string): void {
  void sessionId
  // Placeholder — 迭代四实现 pending message queue
}

export function getPendingSessionMessageCountForSession(sessionId: string): number {
  void sessionId
  return 0
}

export function subscribePendingSessionMessages(sessionId: string, callback: (count: number) => void): () => void {
  void sessionId
  void callback
  return () => {}
}
