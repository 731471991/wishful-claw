export type ExtensionToolKind = 'http' | 'js'
export type ExtensionUiKind = 'card' | 'table' | 'form' | 'chart' | 'html' | 'component'

export interface ExtensionConfigFieldSchema {
  key: string
  label: string
  type: 'text' | 'secret'
  required?: boolean
  description?: string
  placeholder?: string
  defaultValue?: string
}

export interface ExtensionHttpDefinition {
  method: string
  url: string
  headers?: Record<string, string>
  body?: unknown
}

export interface ExtensionToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  kind: ExtensionToolKind
  http?: ExtensionHttpDefinition
  handler?: string
  readOnly?: boolean
}

export interface ExtensionFetchRequest {
  method?: string
  url: string
  headers?: Record<string, string>
  body?: unknown
}

export interface ExtensionFetchResponse {
  ok: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  text: string
  json?: unknown
}

export interface ExtensionRendererDefinition {
  name: string
  type: 'html'
  entry: string
}

export interface ExtensionComponentDefinition {
  name: string
  type: 'html'
  entry: string
  title?: string
  description?: string
}

export interface ExtensionMcpServerDefinition {
  transport?: 'stdio' | 'sse' | 'streamable-http'
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
  description?: string
}

export interface ExtensionInterfaceMeta {
  displayName?: string
  category?: string
  defaultPrompt?: string[]
  icon?: string
  brandColor?: string
}

export interface ExtensionManifest {
  schemaVersion: 1
  id: string
  name: string
  version: string
  description?: string
  entry?: string
  configSchema?: ExtensionConfigFieldSchema[]
  permissions?: {
    network?: string[]
  }
  tools: ExtensionToolDefinition[]
  renderers?: ExtensionRendererDefinition[]
  components?: ExtensionComponentDefinition[]
  // Aggregate resources: bundled content synced into the user content
  // directories while the extension is enabled. Paths are relative to the
  // extension root. Parsed from the on-disk extension.json by the main
  // process; instances returned by the native worker may omit these fields.
  skills?: string
  agents?: string
  commands?: string
  mcpServers?: Record<string, ExtensionMcpServerDefinition>
  state?: boolean
  interface?: ExtensionInterfaceMeta
}

export interface ExtensionInstance {
  id: string
  enabled: boolean
  installedAt: number
  updatedAt: number
  config: Record<string, string>
  manifest: ExtensionManifest
}

export interface ExtensionToolResult {
  __openCoworkExtensionResult: true
  extensionId: string
  toolName?: string
  text?: string
  data?: unknown
  ui?: {
    kind: ExtensionUiKind
    [key: string]: unknown
  }
}
