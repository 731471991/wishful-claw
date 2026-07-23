// Stub: MCP types

export type McpServerStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

export interface McpServerConfig {
  id: string
  createdAt: number
  enabled?: boolean
  projectId?: string
  name?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  [key: string]: unknown
}

export interface McpServer { [key: string]: unknown }

export interface McpTool { [key: string]: unknown }

export interface McpResource {
  uri?: string
  name?: string
  description?: string
  mimeType?: string
  [key: string]: unknown
}

export interface McpPrompt {
  name?: string
  description?: string
  arguments?: unknown[]
  [key: string]: unknown
}

export interface McpServerInfo {
  config: McpServerConfig
  status: McpServerStatus
  tools: McpTool[]
  resources: McpResource[]
  prompts: McpPrompt[]
  error?: string
}
