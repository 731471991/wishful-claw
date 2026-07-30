/**
 * MCP Registry API client — queries the official registry at
 * registry.modelcontextprotocol.io to discover and install MCP servers.
 *
 * API docs: https://modelcontextprotocol.info/zh-cn/tools/registry/
 * Endpoint: GET /v0/servers?search=xxx&limit=N&isLatest=true
 */

const REGISTRY_BASE = 'https://registry.modelcontextprotocol.io/v0'

export interface RegistryEnvVar {
  name: string
  description?: string
  value?: string
  isRequired?: boolean
  isSecret?: boolean
  default?: string
}

export interface RegistryRuntimeArg {
  value: string
  type?: 'positional' | 'named'
  name?: string
}

export interface RegistryPackage {
  registryType?: string
  registryBaseUrl?: string
  identifier?: string
  version?: string
  runtimeHint?: string
  transport?: { type: string }
  runtimeArguments?: RegistryRuntimeArg[]
  environmentVariables?: RegistryEnvVar[]
}

export interface RegistryRemote {
  type: string
  url: string
  headers?: RegistryEnvVar[]
}

export interface RegistryServer {
  name: string
  title?: string
  description?: string
  version?: string
  repository?: { url: string; source?: string; subfolder?: string }
  websiteUrl?: string
  categories?: string[]
  icons?: Array<{ src: string; mimeType?: string; sizes?: string[] }>
  remotes?: RegistryRemote[]
  packages?: RegistryPackage[]
}

export interface RegistrySearchResult {
  server: RegistryServer
  isLatest: boolean
}

export interface RegistrySearchResponse {
  servers: RegistrySearchResult[]
  metadata?: { nextCursor?: string; count?: number }
}

/**
 * Search the MCP registry for servers.
 * Returns only the latest version of each server.
 */
export async function searchMcpServers(
  query: string,
  limit = 20
): Promise<RegistrySearchResult[]> {
  const params = new URLSearchParams()
  if (query.trim()) params.set('search', query.trim())
  params.set('limit', String(limit))
  params.set('isLatest', 'true')

  const url = `${REGISTRY_BASE}/servers?${params.toString()}`
  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`Registry search failed: ${resp.status} ${resp.statusText}`)
  }
  const data = (await resp.json()) as RegistrySearchResponse
  return data.servers ?? []
}

/**
 * Convert a registry package to a McpServerConfig-compatible config.
 * Returns null if the package cannot be auto-configured (missing identifier/transport).
 */
export function packageToServerConfig(
  server: RegistryServer,
  pkg: RegistryPackage
): {
  name: string
  description?: string
  transport: 'stdio' | 'sse' | 'streamable-http'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
} | null {
  const transportType = pkg.transport?.type ?? 'stdio'
  const name = server.title ?? server.name.split('/').pop() ?? server.name

  if (transportType === 'stdio') {
    const runtimeHint = pkg.runtimeHint ?? 'npx'
    const identifier = pkg.identifier
    if (!identifier) return null

    const args: string[] = []
    // Runtime arguments (e.g. -y)
    for (const arg of pkg.runtimeArguments ?? []) {
      args.push(arg.value)
    }
    // Add the package identifier
    args.push(identifier)

    return {
      name,
      description: server.description,
      transport: 'stdio',
      command: runtimeHint,
      args,
      env: undefined
    }
  }

  if (transportType === 'sse' || transportType === 'streamable-http') {
    // For remote servers, use the first remote URL
    const remote = server.remotes?.[0]
    if (!remote?.url) return null

    const headers: Record<string, string> = {}
    for (const h of remote.headers ?? []) {
      if (!h.isRequired && !h.default) continue
      headers[h.name] = h.default ?? h.value ?? ''
    }

    return {
      name,
      description: server.description,
      transport: transportType as 'sse' | 'streamable-http',
      url: remote.url,
      headers: Object.keys(headers).length > 0 ? headers : undefined
    }
  }

  return null
}

/**
 * Check if a registry server requires environment variables
 * (meaning the user must fill them in before installation).
 */
export function getRequiredEnvVars(server: RegistryServer): RegistryEnvVar[] {
  const vars: RegistryEnvVar[] = []
  for (const pkg of server.packages ?? []) {
    for (const v of pkg.environmentVariables ?? []) {
      if (v.isRequired && !v.default) {
        vars.push(v)
      }
    }
  }
  return vars
}

/**
 * Check if a registry server can be installed with one click
 * (no required env vars without defaults).
 */
export function isOneClickInstallable(server: RegistryServer): boolean {
  return getRequiredEnvVars(server).length === 0
}
