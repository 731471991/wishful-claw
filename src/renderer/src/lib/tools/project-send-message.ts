/**
 * Project Send-Session-Message Handler
 *
 * Handles `project/send-session-message` reverse-request from the native worker.
 * The global session (project manager) sends a message to a target project session
 * via the normal sendMessage pipeline — fully simulating a user action.
 *
 * Before calling sendMessage, ensures the target session exists in the chat store
 * (injected if missing). Uses Promise.race with a short timeout so dbUpsertMessage
 * (now awaited) completes before returning, but doesn't block the global session
 * waiting for the full agent/run to finish.
 *
 * Flow:
 *   Worker (send_session_message tool)
 *     → reverse-request "project/send-session-message"
 *     → Main process (rendererMethods)
 *     → Renderer (this handler)
 *     → Ensure session in store → chatStore.sendMessage() → agent/run
 *     → Response back to Worker (after timeout, agent/run continues in background)
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
        messagesLoaded: false,
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

  // 3. Send message with short timeout — enough for dbUpsertMessage to persist,
  //    but doesn't block the global session waiting for agent/run to complete.
  try {
    await Promise.race([
      useChatStore.getState().sendMessage({
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
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 500))
    ])

    // Debug: check store state after sendMessage (or timeout)
    const storeAfter = useChatStore.getState()
    const sessionAfter = storeAfter.sessions.find((s) => s.id === sessionId)
    const msgCount = sessionAfter?.messages?.length ?? -1
    const hasStreaming = !!(storeAfter as unknown as { streamingMessages?: Record<string, string> }).streamingMessages?.[sessionId]
    const sessionTitle = sessionAfter?.title ?? 'unknown'
    const storeSessionCount = storeAfter.sessions.length

    return {
      success: true,
      result: `Message sent to session "${sessionTitle}" (${sessionId}). ` +
        `Store state: sessionExists=${!!sessionAfter}, msgCount=${msgCount}, ` +
        `streamingSet=${hasStreaming}, totalSessionsInStore=${storeSessionCount}. ` +
        `The target session is now processing. Check back later with get_project_details.`
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to send message: ${msg}` }
  }
}