import type { RequestDebugInfo, TokenUsage, ToolDefinition, UnifiedMessage } from '../api/types'

export interface CacheShapeDebugInfo {
  systemHash: string
  toolsHash: string
  messagePrefixHash: string
  toolCount: number
}

export function stableStringify(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value) ?? String(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`

  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`
}

export function stableHash(value: unknown): string {
  const text = typeof value === 'string' ? value : stableStringify(value)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${hash.toString(16).padStart(8, '0')}:${text.length.toString(36)}`
}

function compareToolDefinitions(a: ToolDefinition, b: ToolDefinition): number {
  const byName = a.name.localeCompare(b.name)
  if (byName !== 0) return byName
  const byDescription = a.description.localeCompare(b.description)
  if (byDescription !== 0) return byDescription
  return stableStringify(a.inputSchema).localeCompare(stableStringify(b.inputSchema))
}

function normalizeToolDefinition(tool: ToolDefinition): unknown {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }
}

function getMessagePrefix(messages: UnifiedMessage[]): UnifiedMessage[] {
  const lastUserIndex = messages.reduce((index, message, currentIndex) => {
    return message.role === 'user' ? currentIndex : index
  }, -1)

  return lastUserIndex >= 0 ? messages.slice(0, lastUserIndex) : messages
}

function normalizeMessageForHash(message: UnifiedMessage): unknown {
  return {
    role: message.role,
    content: message.content,
    providerResponseId: message.providerResponseId,
    source: message.source
  }
}

type CacheRatioUsage = Partial<Pick<TokenUsage, 'inputTokens' | 'cacheReadTokens'>> | null | undefined

function readTokenCount(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

export function calculateCacheReadRatio(usage: CacheRatioUsage): number | undefined {
  const inputTokens = readTokenCount(usage?.inputTokens)
  if (inputTokens <= 0) return undefined

  const cacheReadTokens = readTokenCount(usage?.cacheReadTokens)
  return Math.min(1, cacheReadTokens / inputTokens)
}

export function buildCacheShapeDebugInfo(args: {
  systemPrompt: string
  tools: ToolDefinition[]
  messages: UnifiedMessage[]
}): CacheShapeDebugInfo {
  const stableTools = [...args.tools].sort(compareToolDefinitions).map(normalizeToolDefinition)
  const messagePrefix = getMessagePrefix(args.messages).map(normalizeMessageForHash)

  return {
    systemHash: stableHash(args.systemPrompt),
    toolsHash: stableHash(stableTools),
    messagePrefixHash: stableHash(messagePrefix),
    toolCount: args.tools.length
  }
}

export function withCacheShapeDebugInfo(
  debugInfo: RequestDebugInfo,
  cacheShape: CacheShapeDebugInfo,
  usage?: Pick<TokenUsage, 'inputTokens' | 'cacheReadTokens'> | null
): RequestDebugInfo {
  const cacheReadRatio = calculateCacheReadRatio(usage)
  return {
    ...debugInfo,
    ...cacheShape,
    ...(cacheReadRatio !== undefined ? { cacheReadRatio } : {})
  }
}
