import type { ProviderConfig } from '../../api/types'
import { OPENAI_RESPONSES_SUB_AGENT_SCOPE_PREFIX } from '../../../../../shared/openai-responses-session'
import { clampOpenAIPromptCacheKey } from '../prompt-cache-key'

function normalizeCacheSegment(value: string | null | undefined, fallback: string): string {
  const normalized = (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return normalized || fallback
}

function hashSegment(value: string, length = 8): string {
  let hashA = 0x811c9dc5
  let hashB = 0x9e3779b9
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    hashA ^= code
    hashA = Math.imul(hashA, 0x01000193) >>> 0
    hashB ^= code
    hashB = Math.imul(hashB, 0x85ebca6b) >>> 0
  }
  return `${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`.slice(
    0,
    length
  )
}

function countUnicodeChars(value: string): number {
  return Array.from(value).length
}

function buildSubAgentPromptCacheKey(parentKey: string, agentSegment: string): string | undefined {
  const parent = clampOpenAIPromptCacheKey(parentKey)
  if (!parent) return undefined

  const agentHash = hashSegment(agentSegment)
  const candidate = `${parent}-sa-${agentHash}`
  if (countUnicodeChars(candidate) <= 64) {
    return candidate
  }
  return `ocw-sa-${hashSegment(parent, 16)}-${agentHash}`
}

function shouldSetPromptCacheKey(config: ProviderConfig): boolean {
  if (config.type !== 'openai-responses') return false
  const existing = config.requestOverrides?.body?.prompt_cache_key
  return typeof existing !== 'string' || !existing.trim()
}

export function withSubAgentRuntimeCachePolicy(
  config: ProviderConfig,
  options: {
    agentName: string
    sessionId?: string | null
    runScopeId?: string | null
  }
): ProviderConfig {
  const agentSegment = normalizeCacheSegment(options.agentName, 'agent')
  const runSegment = normalizeCacheSegment(options.runScopeId, agentSegment)
  let next = config

  if (next.type === 'openai-responses') {
    next = {
      ...next,
      responsesSessionScope: `${OPENAI_RESPONSES_SUB_AGENT_SCOPE_PREFIX}:${runSegment}`
    }
  }

  if (shouldSetPromptCacheKey(next)) {
    const parentKey = next.promptCacheKey?.trim()
    if (parentKey) {
      const promptCacheKey = buildSubAgentPromptCacheKey(parentKey, agentSegment)
      next = {
        ...next,
        ...(promptCacheKey ? { promptCacheKey } : {})
      }
    }
  }

  return next
}
