// ── MCP System — Shared Types ──

/** Transport type for MCP server connections */
export type McpTransportType = 'stdio' | 'sse' | 'streamable-http'

/** MCP server configuration */
export interface McpServerConfig {
  id: string
  name: string
  enabled: boolean
  projectId?: string | null

  // Transport
  transport: McpTransportType

  // stdio config
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string

  // HTTP config
  url?: string
  headers?: Record<string, string>
  autoFallback?: boolean

  // Metadata
  createdAt: number
  description?: string
}

/** MCP server runtime status */
export type McpServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/** MCP Tool */
export interface McpTool {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

/** MCP Resource */
export interface McpResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

/** MCP Prompt */
export interface McpPrompt {
  name: string
  description?: string
  arguments?: Array<{ name: string; description?: string; required?: boolean }>
}

/** Full MCP server info */
export interface McpServerInfo {
  config: McpServerConfig
  status: McpServerStatus
  tools: McpTool[]
  resources: McpResource[]
  prompts: McpPrompt[]
  error?: string
}
