import { useMcpStore } from '../../stores/mcp-store'
import { unregisterMcpTools } from '../mcp/mcp-tools'

let _lastSignature = ''

/**
 * Refresh MCP capability metadata based on currently connected servers.
 *
 * MCP tools are no longer registered as individual tools in the toolRegistry.
 * They are accessed via the unified use_capability proxy tool.
 * This function tracks metadata changes so the capability route text
 * and mcp:capability-list reverse-request handler stay up to date.
 */
export async function refreshMcpTools(): Promise<void> {
  const store = useMcpStore.getState()

  // Ensure servers are loaded
  if (!store.serversLoaded) {
    await store.loadServers()
  }

  // Get active (connected) MCP servers for the current project
  const activeServers = store.getActiveMcps()
  const activeTools = store.getActiveMcpTools()
  const activeResources = store.getActiveMcpResources()

  // Build a signature to detect changes
  const signature = JSON.stringify({
    servers: activeServers.map((s) => s.id),
    tools: Object.fromEntries(
      Object.entries(activeTools).map(([id, tools]) => [
        id,
        tools.map((t) => t.name)
      ])
    ),
    resources: Object.fromEntries(
      Object.entries(activeResources).map(([id, resources]) => [
        id,
        resources.map((r) => r.name)
      ])
    )
  })

  if (signature === _lastSignature) return
  _lastSignature = signature

  // Clean up any previously registered MCP tools (from older versions
  // that registered them individually).
  unregisterMcpTools()
}
