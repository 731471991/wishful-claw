// Run change set resolution utilities

import type { AgentRunChangeSet } from '@renderer/stores/agent-store'
import { aggregateDisplayableRunFileChanges } from '../file-change-utils'

export function resolveRunChangeSetForMessage(
  changesByRunId: Record<string, AgentRunChangeSet>,
  msgId?: string,
  sessionId?: string | null,
  toolUseIds: readonly string[] = []
): AgentRunChangeSet | undefined {
  if (!msgId) return undefined

  const exact = changesByRunId[msgId]
  if (exact) return exact

  const uniqueChangeSets = new Map<string, AgentRunChangeSet>()
  for (const changeSet of Object.values(changesByRunId)) {
    uniqueChangeSets.set(changeSet.runId, changeSet)
  }

  for (const changeSet of uniqueChangeSets.values()) {
    if (changeSet.assistantMessageId === msgId) return changeSet
  }

  const toolUseIdSet = new Set(toolUseIds)
  if (toolUseIdSet.size === 0) return undefined

  let bestMatch: { changeSet: AgentRunChangeSet; matchCount: number } | null = null
  for (const changeSet of uniqueChangeSets.values()) {
    let matchCount = 0
    for (const change of changeSet.changes) {
      if (change.toolUseId && toolUseIdSet.has(change.toolUseId)) {
        matchCount += 1
      }
    }
    if (matchCount === 0) continue
    if (
      sessionId &&
      changeSet.sessionId &&
      changeSet.sessionId !== sessionId &&
      !changeSet.changes.some((change) => change.sessionId === sessionId)
    ) {
      continue
    }

    if (
      !bestMatch ||
      matchCount > bestMatch.matchCount ||
      (matchCount === bestMatch.matchCount && changeSet.updatedAt > bestMatch.changeSet.updatedAt)
    ) {
      bestMatch = { changeSet, matchCount }
    }
  }

  return bestMatch?.changeSet
}

export function changeSetBelongsToSession(
  changeSet: AgentRunChangeSet,
  sessionId?: string | null
): boolean {
  if (!sessionId) return false
  return (
    changeSet.sessionId === sessionId ||
    changeSet.changes.some((change) => change.sessionId === sessionId)
  )
}

export function resolveLatestSessionRunChangeSet(
  changesByRunId: Record<string, AgentRunChangeSet>,
  sessionId?: string | null,
  assistantMessageIds: readonly string[] = [],
  toolUseIds: readonly string[] = []
): AgentRunChangeSet | undefined {
  if (!sessionId) return undefined

  const uniqueChangeSets = new Map<string, AgentRunChangeSet>()
  for (const changeSet of Object.values(changesByRunId)) {
    uniqueChangeSets.set(changeSet.runId, changeSet)
  }

  const assistantMessageIdSet = new Set(assistantMessageIds)
  const toolUseIdSet = new Set(toolUseIds)
  let latest: AgentRunChangeSet | undefined
  for (const changeSet of uniqueChangeSets.values()) {
    const matchesSession =
      changeSetBelongsToSession(changeSet, sessionId) ||
      assistantMessageIdSet.has(changeSet.assistantMessageId) ||
      assistantMessageIdSet.has(changeSet.runId) ||
      changeSet.changes.some((change) => change.toolUseId && toolUseIdSet.has(change.toolUseId))

    if (!matchesSession) continue
    if (aggregateDisplayableRunFileChanges(changeSet.changes).length === 0) continue
    if (!latest || changeSet.updatedAt > latest.updatedAt) {
      latest = changeSet
    }
  }

  return latest
}
