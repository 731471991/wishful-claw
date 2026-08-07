/**
 * Project Send-Session-Message Handler
 *
 * Handles `project/send-session-message` reverse-request from the native worker.
 * The global session (project manager) sends a message to a target project session
 * via the normal sendMessage pipeline — fully simulating a user action.
 *
 * Flow:
 *   Worker (send_session_message tool)
 *     → reverse-request "project/send-session-message"
 *     → Main process (rendererMethods)
 *     → Renderer (this handler)
 *     → chatStore.sendMessage() → agent/run
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

  // 1. Get provider config from store
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

  // 2. Call sendMessage to trigger the Agent Loop
  try {
    await useChatStore.getState().sendMessage({
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

    return { success: true, result: 'Message sent successfully.' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to send message: ${msg}` }
  }
}