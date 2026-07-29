import { useMcpStore } from '../../stores/mcp-store'
import { registerMcpTools, registerMcpResources, unregisterMcpTools } from '../mcp/mcp-tools'

let _lastSignature = ''

/**
 * Refresh MCP tools in the tool registry based on currently connected servers.
 *
 * Unlike Skills (which are static metadata), MCP tools are only available
 * after a server is connected and its capabilities are discovered.
 * This function reads the active MCP servers + their tools/resources from
 * mcp-store and registers/unregisters tool handlers accordingly.
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

  // Unregister old, register new
  unregisterMcpTools()
  registerMcpTools(activeServers, activeTools)
  registerMcpResources(activeServers, activeResources)
}
