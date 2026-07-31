/**
 * Helpers for maintaining session-level cumulative usage totals.
 *
 * Instead of traversing all messages on every render, we cache the totals
 * on the Session object and update them incrementally:
 *  - {@link initSessionUsageTotals}: called once after loading messages from DB
 *  - {@link applyUsageDeltaToSession}: called on each message_end event
 */

import type { Session, SessionUsageTotals } from './types'
import type { TokenUsage, AIModelConfig, RequestTiming } from '@renderer/lib/api/types'
import {
  calculateCost,
  calculateCostBreakdown,
  getBillableInputTokens,
  getCacheCreationTokens,
  getCacheCreationSplit,
} from '@renderer/lib/format-tokens'

export function createEmptySessionUsageTotals(): SessionUsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    billableInputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    cacheCreation5mTokens: 0,
    cacheCreation1hTokens: 0,
    inputCost: null,
    outputCost: null,
    cacheReadCost: null,
    cacheCreationCost: null,
    totalCost: null,
    latestRequestTiming: null,
  }
}

function normalizeTokenCount(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

function getLatestRequestTiming(usage: TokenUsage | undefined): RequestTiming | null {
  const timings = usage?.requestTimings
  if (!timings?.length) return null
  for (let index = timings.length - 1; index >= 0; index -= 1) {
    const timing = timings[index]
    if (
      (typeof timing?.ttftMs === 'number' && Number.isFinite(timing.ttftMs) && timing.ttftMs > 0) ||
      (typeof timing?.tps === 'number' && Number.isFinite(timing.tps) && timing.tps > 0)
    ) {
      return timing
    }
  }
  return null
}

function sumNullableCost(current: number | null, next: number | null): number | null {
  if (next == null) return current
  return (current ?? 0) + next
}

/**
 * Add a single message's usage to a totals object.
 * Mutates `totals` in place.
 */
export function addMessageUsageToTotals(
  totals: SessionUsageTotals,
  usage: TokenUsage | undefined,
  modelCfg: AIModelConfig | null | undefined
): void {
  if (!usage) return
  totals.inputTokens += normalizeTokenCount(usage.inputTokens)
  totals.outputTokens += normalizeTokenCount(usage.outputTokens)
  totals.billableInputTokens += normalizeTokenCount(getBillableInputTokens(usage))
  totals.cacheReadTokens += normalizeTokenCount(usage.cacheReadTokens)
  totals.cacheCreationTokens += normalizeTokenCount(getCacheCreationTokens(usage))
  const split = getCacheCreationSplit(usage)
  totals.cacheCreation5mTokens += normalizeTokenCount(split.fiveMinuteTokens)
  totals.cacheCreation1hTokens += normalizeTokenCount(split.oneHourTokens)

  const timing = getLatestRequestTiming(usage)
  if (timing) totals.latestRequestTiming = timing

  const costBreakdown = calculateCostBreakdown(usage, modelCfg)
  totals.inputCost = sumNullableCost(totals.inputCost, costBreakdown.inputCost)
  totals.outputCost = sumNullableCost(totals.outputCost, costBreakdown.outputCost)
  totals.cacheReadCost = sumNullableCost(totals.cacheReadCost, costBreakdown.cacheReadCost)
  totals.cacheCreationCost = sumNullableCost(totals.cacheCreationCost, costBreakdown.cacheCreationCost)

  const msgCost = calculateCost(usage, modelCfg)
  if (msgCost !== null) {
    totals.totalCost = (totals.totalCost ?? 0) + msgCost
  }
}

/**
 * Initialize session.usageTotals by traversing all loaded messages once.
 * Called after loadRecentSessionMessages.
 */
export function initSessionUsageTotals(
  session: Session,
  providers: Array<{ id: string; models: Array<AIModelConfig & { id: string }> }>
): void {
  const totals = createEmptySessionUsageTotals()
  for (const msg of session.messages) {
    if (!msg.usage) continue
    const reqModel = msg.meta?.requestModel
    const providerId = reqModel?.providerId ?? msg.debugInfo?.providerId ?? null
    const modelId = reqModel?.modelId ?? msg.debugInfo?.model ?? null
    const provider = providerId ? (providers.find((p) => p.id === providerId) ?? null) : null
    const modelCfg =
      (provider && modelId
        ? (provider.models.find((m) => m.id === modelId) ?? null)
        : null) ?? null
    addMessageUsageToTotals(totals, msg.usage, modelCfg)
  }
  session.usageTotals = totals
}

/**
 * Apply a usage delta (from a message_end event) to session.usageTotals.
 * Creates the totals object if it doesn't exist yet.
 * Mutates session.usageTotals in place.
 */
export function applyUsageDeltaToSession(
  session: Session,
  usage: TokenUsage | undefined,
  modelCfg: AIModelConfig | null | undefined
): void {
  if (!usage) return
  if (!session.usageTotals) {
    session.usageTotals = createEmptySessionUsageTotals()
  }
  addMessageUsageToTotals(session.usageTotals, usage, modelCfg)
}
