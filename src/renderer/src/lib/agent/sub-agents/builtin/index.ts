import { createTaskTool } from '../create-tool'
import { toolRegistry } from '../../tool-registry'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { useProviderStore } from '@renderer/stores/provider-store'
import type { ProviderConfig } from '../../../api/types'
import { refreshSubAgentRegistry } from '../catalog'

const TASK_TOOL_REGISTRY_NAME = 'Task'

function getProviderConfig(): ProviderConfig {
  const s = useSettingsStore.getState()
  const store = useProviderStore.getState()
  const fastConfig = store.getFastProviderConfig()
  if (fastConfig && (fastConfig.apiKey || fastConfig.requiresApiKey === false)) {
    return {
      ...fastConfig,
      maxTokens: store.getEffectiveMaxTokens(s.maxTokens, fastConfig.model),
      temperature: s.temperature
    }
  }
  const fallbackModel = s.model
  return {
    type: s.provider,
    apiKey: s.apiKey,
    baseUrl: s.baseUrl || undefined,
    model: fallbackModel,
    maxTokens: store.getEffectiveMaxTokens(s.maxTokens, fallbackModel),
    temperature: s.temperature
  }
}

/**
 * Load all agent .md files from ~/.open-cowork/agents/ via IPC,
 * register them in the SubAgent registry, then register one unified
 * "Task" tool in the tool registry.
 *
 * This is async because it reads files via IPC from the main process.
 */
export async function refreshSubAgentTools(): Promise<void> {
  const refreshStatus = await refreshSubAgentRegistry()
  if (refreshStatus === 'failed' && toolRegistry.has(TASK_TOOL_REGISTRY_NAME)) {
    return
  }
  if (refreshStatus === 'unchanged' && toolRegistry.has(TASK_TOOL_REGISTRY_NAME)) return

  // Register one unified Task tool that dispatches by subagent_type
  // (works even if no agents were loaded — will produce an empty enum)
  toolRegistry.register(createTaskTool(getProviderConfig))
}

export async function registerSubAgents(): Promise<void> {
  await refreshSubAgentTools()
}
