import type { TokenUsage } from '../api/types'
import { calculateCacheReadRatio } from './cache-shape'

function positive(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function hasRequestTiming(usage: Partial<TokenUsage>): boolean {
  return Array.isArray(usage.requestTimings) && usage.requestTimings.length > 0
}

function isContextOnlyUsagePatch(usage: Partial<TokenUsage>): boolean {
  const hasAccountingTokens =
    positive(usage.inputTokens) ||
    positive(usage.outputTokens) ||
    positive(usage.billableInputTokens) ||
    positive(usage.cacheCreationTokens) ||
    positive(usage.cacheCreation5mTokens) ||
    positive(usage.cacheCreation1hTokens) ||
    positive(usage.cacheReadTokens) ||
    positive(usage.reasoningTokens) ||
    positive(usage.totalDurationMs) ||
    hasRequestTiming(usage)

  return (
    !hasAccountingTokens &&
    (positive(usage.contextTokens) || positive(usage.contextLength)) &&
    (usage.inputTokens ?? 0) === 0 &&
    (usage.outputTokens ?? 0) === 0
  )
}

/**
 * Token fields that represent per-request counts and should be summed
 * across multiple API calls within a single agent turn (message_end events).
 */
const ACCUMULABLE_TOKEN_FIELDS = [
  'inputTokens',
  'outputTokens',
  'billableInputTokens',
  'cacheReadTokens',
  'cacheCreationTokens',
  'cacheCreation5mTokens',
  'cacheCreation1hTokens',
  'reasoningTokens',
  'totalDurationMs'
] as const

/**
 * Accumulate (sum) token counts across multiple LLM API calls within the same
 * agent message. Unlike {@link mergeUsageSnapshot} which replaces values,
 * this function sums numeric token fields so that the cumulative total never
 * decreases when a later API call reports lower values (e.g. after cache warmup).
 *
 * Context-related fields (contextTokens, contextLength) are replaced with the
 * latest value. requestTimings are appended.
 */
export function accumulateUsageSnapshot(
  current: TokenUsage | undefined,
  incoming: Partial<TokenUsage> | undefined
): TokenUsage | undefined {
  if (!incoming) return current
  if (!current) {
    const result = { ...incoming } as TokenUsage
    const ratio = calculateCacheReadRatio(result)
    if (ratio === undefined) delete result.cacheReadRatio
    else result.cacheReadRatio = ratio
    return result
  }

  const result: TokenUsage = { ...current }

  for (const field of ACCUMULABLE_TOKEN_FIELDS) {
    const currentVal = typeof current[field] === 'number' ? (current[field] as number) : 0
    const incomingVal = typeof incoming[field] === 'number' ? (incoming[field] as number) : 0
    if (currentVal > 0 || incomingVal > 0) {
      ;(result as unknown as Record<string, unknown>)[field] = currentVal + incomingVal
    }
  }

  // Replace context-related fields with latest values
  if (incoming.contextTokens != null) result.contextTokens = incoming.contextTokens
  if (incoming.contextLength != null) result.contextLength = incoming.contextLength

  // Append request timings
  if (incoming.requestTimings?.length) {
    result.requestTimings = [...(result.requestTimings ?? []), ...incoming.requestTimings]
  }

  // Recalculate cacheReadRatio from accumulated totals
  const ratio = calculateCacheReadRatio(result)
  if (ratio === undefined) delete result.cacheReadRatio
  else result.cacheReadRatio = ratio

  return result
}

export function mergeUsageSnapshot(
  current: TokenUsage | undefined,
  incoming: Partial<TokenUsage> | undefined
): TokenUsage | undefined {
  if (!incoming) return current

  const merged: TokenUsage = current
    ? { ...current }
    : {
        inputTokens: 0,
        outputTokens: 0
      }
  const contextOnlyPatch = current ? isContextOnlyUsagePatch(incoming) : false

  for (const [key, value] of Object.entries(incoming) as Array<
    [keyof TokenUsage, TokenUsage[keyof TokenUsage]]
  >) {
    if (value === undefined) continue
    if (contextOnlyPatch && (key === 'inputTokens' || key === 'outputTokens')) {
      continue
    }
    ;(merged as Record<keyof TokenUsage, TokenUsage[keyof TokenUsage]>)[key] = value
  }

  const cacheReadRatio = calculateCacheReadRatio(merged)
  if (cacheReadRatio === undefined) {
    delete merged.cacheReadRatio
  } else {
    merged.cacheReadRatio = cacheReadRatio
  }

  return merged
}
