/**
 * QQ Wakeup DAO — stub.
 *
 * The original OpenCowork implementation had a full QQ wakeup tracking system.
 * This stub provides the same interface so the QQ provider compiles, but
 * returns disabled wakeup (no-op). Enable when QQ channel is officially needed.
 */

export interface QqWakeupEligibility {
  enabled: boolean
  periodKey?: string
  sourceMessageId?: string
  sourceTimestamp?: number
}

export async function resolveQqWakeupEligibility(
  _pluginId: string,
  _chatId: string
): Promise<QqWakeupEligibility> {
  return { enabled: false }
}

export async function markQqWakeupSent(
  _pluginId: string,
  _chatId: string,
  _periodKey: string
): Promise<void> {
  // no-op
}
