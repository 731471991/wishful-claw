import { useCallback } from 'react'
import { useChatStore } from '@renderer/stores/chat-store'
import { useProviderStore } from '@renderer/stores/provider-store'
import { useActivityStore } from '@renderer/stores/activity-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { getCachedTools, fetchToolDefinitions } from '@renderer/lib/tools/tool-cache'

export interface SendMessageOptions {
  clearCompletedTasksOnTurnStart?: boolean
  enablePlanMode?: boolean
  selectedFileReferences?: unknown[]
  goalObjective?: string
  imageEdit?: unknown
  [key: string]: unknown
}


export function useChatActions() {
  const sendMessage = useChatStore((s) => s.sendMessage)
  const cancelStream = useChatStore((s) => s.cancelStream)

  const handleSendMessage = useCallback(
    async (text: string | { text: string; images?: unknown[]; skill?: string | null; selectedFiles?: unknown[] }, _images?: unknown[], _options?: unknown, sessionId?: string, _planId?: string, _workingFolder?: string, opts?: SendMessageOptions) => {
      const textStr = typeof text === 'string' ? text : text.text
      const providerStore = useProviderStore.getState()
      const activeProvider = providerStore.getActiveProvider()
      if (!activeProvider) {
        console.error('[ChatActions] No provider selected')
        return
      }
      const modelId = providerStore.activeModelId || activeProvider.defaultModel || activeProvider.models.find((m) => m.enabled)?.id
      if (!modelId) {
        console.error('[ChatActions] No model selected')
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

      // Get session's working folder — fall back to project's workingFolder
      const session = chatStore.sessions.find((s) => s.id === targetSessionId)
      const projectId = session?.projectId
      const project = projectId ? chatStore.projects.find((p) => p.id === projectId) : null
      const workingFolder = session?.workingFolder ?? project?.workingFolder ?? _workingFolder ?? undefined
      const projectName = project?.name

      // Build messages from session history — include tool call context
      // so the LLM has full conversation history (text + tool_use + tool_result)
      const historyMessages: Array<{ role: string; content: string | Array<Record<string, unknown>> }> = []
      for (const m of (session?.messages ?? [])) {
        if (m.isStreaming) continue
        if (m.role !== 'user' && m.role !== 'assistant') continue

        if (m.role === 'user') {
          historyMessages.push({ role: 'user', content: m.text })
          continue
        }

        // Assistant message — may have tool calls
        if (m.toolCalls && m.toolCalls.length > 0) {
          // Build content blocks: text + tool_use blocks
          const blocks: Array<Record<string, unknown>> = []
          if (m.text) {
            blocks.push({ type: 'text', text: m.text })
          }
          for (const tc of m.toolCalls) {
            blocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.input ?? {}
            })
          }
          historyMessages.push({ role: 'assistant', content: blocks })

          // Emit a user message with tool_result blocks for completed tool calls
          const completedTools = m.toolCalls.filter(
            (tc) => tc.status === 'completed' || tc.status === 'error'
          )
          if (completedTools.length > 0) {
            const resultBlocks: Array<Record<string, unknown>> = completedTools.map((tc) => ({
              type: 'tool_result',
              toolUseId: tc.id,
              content: tc.output ?? (tc.error ?? ''),
              isError: tc.status === 'error'
            }))
            historyMessages.push({ role: 'user', content: resultBlocks })
          }
        } else {
          // Plain assistant message with text only
          historyMessages.push({ role: 'assistant', content: m.text })
        }
      }

      // Tool definitions: use whatever is already cached/registered.
      // App startup (registerAllTools + ensureConversationReady) handles
      // initialization; if tools aren't ready yet, send without them —
      // the agent can still respond, just without tool-calling capability.
      const toolPreset = workingFolder ? 'coding' : 'chat'
      const settings = useSettingsStore.getState()
      const workerTools = getCachedTools()
      fetchToolDefinitions(toolPreset) // fire-and-forget background fetch
      // Filter out WebSearch/WebFetch when web search is not enabled.
      const webSearchEnabled = settings.webSearchEnabled
      const filteredWorkerTools = (workerTools ?? []).filter(
        (t) => webSearchEnabled || (t.name !== 'WebSearch' && t.name !== 'WebFetch')
      )
      // Use only the Worker's preset-filtered tool list.
      // Renderer-registered tool handlers are still available for execution
      // (toolRegistry.get() works by name), but their definitions are NOT
      // sent to the LLM — this keeps the tool list lean and lets the Worker's
      // ToolPreset control what the LLM sees.
      const tools = filteredWorkerTools

      const provider = {
        id: activeProvider.id,
        name: activeProvider.name,
        type: activeProvider.type,
        apiKey: activeProvider.apiKey,
        baseUrl: activeProvider.baseUrl,
        model: modelId,
        temperature: settings.temperature ?? undefined,
        maxTokens: settings.maxTokens ?? undefined
      }

      await sendMessage({
        provider,
        messages: [...historyMessages, { role: 'user', content: text }],
        sessionId: targetSessionId,
        tools: tools ?? undefined,
        workingFolder,
        maxIterations: 0, // 0 = unlimited, agent runs until no more tool calls
        maxParallelTools: settings.maxParallelToolCalls,
        maxToolCallsPerTurn: settings.maxToolCallsPerTurn,
        maxConcurrentSubAgents: settings.maxConcurrentSubAgents,
        personaId: session?.personaId ?? settings.defaultPersonaId ?? undefined,
        language: settings.language,
        userRules: settings.systemPrompt || undefined
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

export function clearPendingSessionMessages(sessionId: string): number {
  void sessionId
  // Placeholder — 迭代四实现 pending message queue
  return 0
}

export function getPendingSessionMessageCountForSession(sessionId: string): number {
  void sessionId
  return 0
}

export function subscribePendingSessionMessages(onStoreChange: () => void): () => void {
  _pendingListeners.add(onStoreChange)
  return () => { _pendingListeners.delete(onStoreChange) }
}

export async function sendImplementPlan(_sessionId: string, _planId: string): Promise<void> {
  // TODO: implement plan execution
}

export async function sendImplementPlanInNewSession(_projectId: string | null, _planId: string): Promise<void> {
  // TODO: implement plan execution in new session
}

// === Additional exports needed by OpenCowork InputArea ===

export interface PendingSessionMessageItem {
  id: string
  sessionId: string
  role: 'user'
  content: string
  text: string
  command?: { name: string; content: string } | null
  images: import('@renderer/lib/image-attachments').ImageAttachment[]
  skill?: string | null
  selectedFiles?: unknown[]
  createdAt: number
  draft?: string
}

export type ManualCompressionResult = 'compressed' | 'skipped' | 'blocked' | 'failed'

const _pendingMessages = new Map<string, PendingSessionMessageItem[]>()
const _pendingListeners = new Set<() => void>()

export function getPendingSessionMessages(sessionId: string): PendingSessionMessageItem[] {
  return _pendingMessages.get(sessionId) ?? []
}

export function isPendingSessionDispatchPaused(_sessionId: string): boolean {
  return false
}

export function removePendingSessionMessage(sessionId: string, messageId: string): boolean {
  const list = _pendingMessages.get(sessionId) ?? []
  const filtered = list.filter((m) => m.id !== messageId)
  _pendingMessages.set(sessionId, filtered)
  _pendingListeners.forEach((fn) => fn())
  return filtered.length < list.length
}

export function updatePendingSessionMessageDraft(
  sessionId: string,
  messageId: string,
  draft: unknown
): void {
  const list = _pendingMessages.get(sessionId) ?? []
  const msg = list.find((m) => m.id === messageId)
  if (msg) {
    if (typeof draft === 'string') {
      msg.draft = draft
    } else if (draft && typeof draft === 'object') {
      const d = draft as { text?: string; images?: unknown[]; command?: unknown }
      msg.draft = d.text ?? ''
      if (d.images) msg.images = d.images as any[]
      if (d.command) msg.command = d.command as any
    }
    _pendingListeners.forEach((fn) => fn())
  }
}

export function quotePendingSessionMessageIntoConversation(
  _sessionId: string,
  _messageId: string
): unknown {
  return null
}

export function dispatchNextQueuedMessageForSession(_sessionId: string): boolean {
  return false
}

export function hasActiveSessionRunForSession(_sessionId: string): boolean {
  return false
}

export function hasPendingSessionMessagesForSession(sessionId: string): boolean {
  return (_pendingMessages.get(sessionId)?.length ?? 0) > 0
}

export function resetTeamAutoTrigger(): void {}

export function stopSessionStreaming(sessionId: string): void {
  abortSession(sessionId)
}
