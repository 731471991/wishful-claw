import { registerTaskTools } from './todo-tool'
import { registerFsTools } from './fs-tool'
import { registerSearchTools } from './search-tool'
import {
  registerWebSearchTool,
  unregisterWebSearchTool,
  isWebSearchToolRegistered
} from './web-search-tool'
import {
  registerCodeGraphExploreTool,
  unregisterCodeGraphExploreTool,
  isCodeGraphExploreToolRegistered,
  registerCodeGraphFullSurface,
  unregisterCodeGraphFullSurface,
  isCodeGraphFullSurfaceRegistered
} from './codegraph-tool'
import { useSettingsStore } from '../../stores/settings-store'
import { registerBashTools } from './bash-tool'
import { registerTeamTools } from '../agent/teams/register'
import { registerWidgetTools } from './widget-tool'
import { registerAskUserTools } from './ask-user-tool'
import { registerPlanTools } from './plan-tool'
import { registerCronTools } from './cron-tool'
import { registerNotifyTool } from './notify-tool'
import { registerGoalTools } from './goal-tool'
import { registerMemoryTools } from './memory-tool'
import { refreshDynamicToolCatalog } from './dynamic-tool-catalog'
import { registerCodeCompatibleTools } from './code-compatible-tool'

let _allToolsRegistered = false

export async function registerAllTools(): Promise<void> {
  if (_allToolsRegistered) return
  _allToolsRegistered = true

  registerTaskTools()
  registerFsTools()
  registerSearchTools()
  // Note: WebSearchTool is NOT registered here — it's registered/unregistered dynamically
  // based on the webSearchEnabled setting (see web-search-tool.ts)
  // Note: codegraph_explore is NOT registered here — it's registered/unregistered
  // dynamically based on the codegraphEnabled setting (see codegraph-tool.ts)
  registerBashTools()
  registerWidgetTools()
  registerAskUserTools()
  registerPlanTools()
  registerCronTools()
  registerNotifyTool()
  registerGoalTools()
  registerMemoryTools()

  // Skills and SubAgents are user-editable catalogs; load them once here and
  // refresh them again before every request via ensureRequestToolCatalogFresh().
  await refreshDynamicToolCatalog()

  // Code-agent-compatible aliases and tool shells layer over the existing
  // OpenCowork implementations.
  registerCodeCompatibleTools()

  // Agent Team tools
  registerTeamTools()

  // Plugin tools are registered/unregistered dynamically via channel-store toggle
  // They are NOT registered here — see plugin-tools.ts registerPluginTools/unregisterPluginTools
}

export function updateWebSearchToolRegistration(enabled: boolean): void {
  const isRegistered = isWebSearchToolRegistered()
  if (enabled && !isRegistered) {
    registerWebSearchTool()
  } else if (!enabled && isRegistered) {
    unregisterWebSearchTool()
  }
}

export function updateCodeGraphToolRegistration(enabled: boolean): void {
  const isRegistered = isCodeGraphExploreToolRegistered()
  if (enabled && !isRegistered) {
    registerCodeGraphExploreTool()
  } else if (!enabled && isRegistered) {
    unregisterCodeGraphExploreTool()
  }

  // Full 8-tool surface (M7-W3): opt-in via settings.codegraphFullToolSurface;
  // the worker's tools-list shapes what actually registers (tiny-repo gating,
  // allowlist). Fire-and-forget — registration failure keeps explore-only.
  const wantFull = enabled && useSettingsStore.getState().codegraphFullToolSurface
  if (wantFull && !isCodeGraphFullSurfaceRegistered()) {
    void registerCodeGraphFullSurface()
  } else if (!wantFull && isCodeGraphFullSurfaceRegistered()) {
    unregisterCodeGraphFullSurface()
  }
}

export { ensureRequestToolCatalogFresh, refreshDynamicToolCatalog } from './dynamic-tool-catalog'
