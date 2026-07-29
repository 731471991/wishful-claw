import { refreshSubAgentTools } from '../agent/sub-agents/builtin'
import { refreshExtensionTools } from '../extensions/extension-tools'
import { refreshSkillTools } from './skill-tool'
import { refreshMcpTools } from './mcp-tool'

let refreshPromise: Promise<void> | null = null

async function runDynamicToolCatalogRefresh(): Promise<void> {
  await refreshSkillTools()
  await refreshSubAgentTools()
  await refreshExtensionTools()
  await refreshMcpTools()
}

export function refreshDynamicToolCatalog(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = runDynamicToolCatalogRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

export const ensureRequestToolCatalogFresh = refreshDynamicToolCatalog
