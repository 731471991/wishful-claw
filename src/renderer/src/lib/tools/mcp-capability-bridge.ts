/**
 * MCP Capability Bridge — handles reverse-requests from the Worker's
 * use_capability executor for listing and inspecting MCP capabilities.
 *
 * The Worker calls mcp:capability-list to discover what MCP servers/tools
 * are available, and mcp:capability-inspect to get a specific tool's schema.
 * The renderer owns MCP connection state (mcp-store), so these requests
 * must be handled here.
 */

import { useMcpStore } from '@renderer/stores/mcp-store'
import { getRegisteredSkills } from '@renderer/lib/tools/skill-tool'
import type { McpTool } from '@renderer/lib/mcp/types'

interface ServerInfo {
  id: string
  name: string
  status: string
  tools: Array<{ name: string; description: string }>
}

interface SkillInfo {
  name: string
  description: string
}

/**
 * Handle mcp:capability-list — return all MCP servers with their tools
 * and all registered Skills.
 */
export async function handleMcpCapabilityList(): Promise<{
  servers: ServerInfo[]
  skills: SkillInfo[]
}> {
  const store = useMcpStore.getState()

  // Ensure servers are loaded
  if (!store.serversLoaded) {
    await store.loadServers()
  }

  const activeServers = store.getActiveMcps()
  const activeTools = store.getActiveMcpTools()
  const statuses = store.serverStatuses

  const servers: ServerInfo[] = activeServers.map((server) => {
    const tools = (activeTools[server.id] ?? []).map((t: McpTool) => ({
      name: t.name,
      description: t.description ?? t.name
    }))
    return {
      id: server.id,
      name: server.name,
      status: statuses[server.id] ?? 'configured',
      tools
    }
  })

  // Skills
  const skills: SkillInfo[] = getRegisteredSkills().map((s) => ({
    name: s.name,
    description: s.description
  }))

  return { servers, skills }
}

/**
 * Handle mcp:capability-inspect — return the input schema for a specific
 * MCP tool.
 */
export async function handleMcpCapabilityInspect(params: {
  serverId: string
  toolName: string
}): Promise<{ name: string; description: string; inputSchema: Record<string, unknown> } | { error: string }> {
  const store = useMcpStore.getState()
  const activeTools = store.getActiveMcpTools()
  const tools = activeTools[params.serverId]

  if (!tools) {
    return { error: `No tools found for MCP server: ${params.serverId}` }
  }

  const tool = tools.find((t) => t.name === params.toolName)
  if (!tool) {
    return { error: `Tool not found: ${params.toolName} on server ${params.serverId}` }
  }

  return {
    name: tool.name,
    description: tool.description ?? tool.name,
    inputSchema: (tool.inputSchema as Record<string, unknown>) ?? { type: 'object', properties: {} }
  }
}
