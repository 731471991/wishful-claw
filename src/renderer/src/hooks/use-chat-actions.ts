import { useCallback } from 'react'
import { useChatStore } from '@renderer/stores/chat-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useActivityStore } from '@renderer/stores/activity-store'

export interface SendMessageOptions {
  clearCompletedTasksOnTurnStart?: boolean
}

// Cache tool definitions to avoid fetching on every message
let cachedTools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> | null = null

async function getToolDefinitions(): Promise<typeof cachedTools> {
  if (cachedTools) return cachedTools
  try {
    const result = await window.api.workerRequest<{ tools: typeof cachedTools }>('tool/list', {})
    cachedTools = result.tools
    return cachedTools
  } catch {
    return null
  }
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

      // Get session's working folder
      const session = chatStore.sessions.find((s) => s.id === targetSessionId)
      const workingFolder = session?.workingFolder ?? _workingFolder ?? undefined

      // Build messages from session history
      const historyMessages = (session?.messages ?? [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .filter((m) => !m.isStreaming)
        .map((m) => ({ role: m.role, content: m.text }))

      // Fetch tool definitions
      const tools = await getToolDefinitions()

      await sendMessage({
        provider,
        messages: [...historyMessages, { role: 'user', content: text }],
        sessionId: targetSessionId,
        tools: tools ?? undefined,
        workingFolder,
        maxIterations: 10
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
