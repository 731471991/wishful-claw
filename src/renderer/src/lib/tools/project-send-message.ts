/**
 * Project Send-Session-Message Handler
 *
 * Handles `project/send-session-message` reverse-request from the native worker.
 * The global session (project manager) sends a message to a target project session
 * via the normal sendMessage pipeline — fully simulating a user action.
 *
 * Before calling sendMessage, ensures the target session exists in the chat store
 * (injected if missing). After sendMessage completes, reads the target session's
 * last assistant message from the store and returns it as the tool result.
 *
 * Flow:
 *   Worker (send_session_message tool)
 *     → reverse-request "project/send-session-message"
 *     → Main process (rendererMethods)
 *     → Renderer (this handler)
 *     → Ensure session in store → chatStore.sendMessage() → agent/run
 *     → Read target session's reply from store
 *     → Response back to Worker
 */

import { useChatStore } from '@renderer/stores/chat-store'
import { useProviderStore } from '@renderer/stores/provider-store'
import { useSettingsStore } from '@renderer/stores/settings-store'

interface SendSessionMessageParams {
  sessionId: string
  content: string
  workingFolder?: string
  projectId?: string
}

export async function handleProjectSendSessionMessage(
  params: unknown
): Promise<{ success: boolean; result?: string; error?: string }> {
  const { sessionId, content, workingFolder, projectId } = params as SendSessionMessageParams

  if (!sessionId || !content) {
    return { success: false, error: 'Missing required fields: sessionId, content' }
  }

  // 1. Ensure target session exists in the chat store
  //    (sendMessage's beginUserTurn silently fails if session is not in store)
  const chatStore = useChatStore.getState()
  const existingSession = chatStore.sessions.find((s) => s.id === sessionId)
  if (!existingSession) {
    useChatStore.setState((state) => {
      state.sessions.push({
        id: sessionId,
        title: 'Project Task',
        mode: 'chat',
        messages: [],
        messageCount: 0,
        messagesLoaded: true,
        loadedRangeStart: 0,
        loadedRangeEnd: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        projectId: projectId || undefined,
        workingFolder: workingFolder || undefined,
        modelSelectionMode: 'inherit'
      })
    })
  }

  // 2. Get provider config from store
  const providerStore = useProviderStore.getState()
  const targetProvider = providerStore.getActiveProvider()
  if (!targetProvider) {
    return { success: false, error: 'No active provider configured. Please configure a provider in Settings.' }
  }

  const modelId = providerStore.activeModelId || targetProvider.defaultModel
  if (!modelId) {
    return { success: false, error: 'No model configured. Please select a model in Settings.' }
  }

  const settings = useSettingsStore.getState()
  const provider = {
    id: targetProvider.id,
    name: targetProvider.name,
    type: targetProvider.type,
    apiKey: targetProvider.apiKey,
    baseUrl: targetProvider.baseUrl,
    model: modelId,
    temperature: settings.temperature ?? undefined,
    maxTokens: settings.maxTokens ?? undefined,
    thinkingEnabled: false
  }

  // 3. Record message count before sending to detect new messages
  const storeBefore = useChatStore.getState()
  const sessionBefore = storeBefore.sessions.find((s) => s.id === sessionId)
  const msgCountBefore = sessionBefore?.messageCount ?? 0

  // 4. Call sendMessage to trigger the Agent Loop
  try {
    await useChatStore.getState().sendMessage({
      sessionMode: 'normal',
      provider,
      messages: [{ role: 'user', content }],
      sessionId,
      toolPreset: workingFolder ? 'coding' : 'chat',
      webSearchEnabled: settings.webSearchEnabled,
      workingFolder: workingFolder || undefined,
      projectId: projectId || undefined,
      maxIterations: 0,
      maxParallelTools: settings.maxParallelToolCalls,
      maxToolCallsPerTurn: settings.maxToolCallsPerTurn,
      maxConcurrentSubAgents: settings.maxConcurrentSubAgents,
      personaId: settings.defaultPersonaId ?? undefined,
      language: settings.language,
      userRules: settings.systemPrompt || undefined,
      contextCompressionEnabled: settings.contextCompressionEnabled,
      contextCompressionThreshold: settings.contextCompressionThreshold
    })

    // 5. Read target session's reply from store
    const storeAfter = useChatStore.getState()
    const sessionAfter = storeAfter.sessions.find((s) => s.id === sessionId)
    let reply = ''

    if (sessionAfter && sessionAfter.messages.length > msgCountBefore) {
      // Find the last non-streaming assistant message
      for (let i = sessionAfter.messages.length - 1; i >= 0; i--) {
        const msg = sessionAfter.messages[i]
        if (msg.role === 'assistant' && !msg.isStreaming) {
          reply = msg.text || extractTextFromContent(msg) || ''
          if (reply) break
        }
      }
    }

    // Build a structured result for the global Agent
    const result = [
      `Message sent to session "${sessionAfter?.title || sessionId}".`,
      reply
        ? `\n\nReply from the target session:\n${reply}`
        : '\n\nThe target session has processed the message (no text reply).'
    ].join('')

    return { success: true, result }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to send message: ${msg}` }
  }
}

function extractTextFromContent(msg: { content?: string | Array<unknown> | Record<string, unknown> }): string {
  if (!msg.content) return ''
  if (typeof msg.content === 'string') return msg.content
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((b: unknown) => (b as { type?: string }).type === 'text')
      .map((b: unknown) => ('text' in (b as Record<string, unknown>) ? (b as Record<string, unknown>).text ?? '' : ''))
      .join('')
  }
  return ''
}