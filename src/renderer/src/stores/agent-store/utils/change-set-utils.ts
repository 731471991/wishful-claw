
import type { ToolCallState } from '../../../lib/agent/types'
import type { AgentRunChangeSet, SessionToolCallCache } from '../types'
import { MAX_RUN_CHANGESETS } from '../constants'

export function isAgentChangeError(value: unknown): value is { error: string } {
  if (!value || typeof value !== 'object') return false
  return typeof (value as { error?: unknown }).error === 'string'
}

export function trimRunChangesMap(map: Record<string, AgentRunChangeSet>): void {
  const entries = Object.entries(map).sort((a, b) => a[1].updatedAt - b[1].updatedAt)
  if (entries.length <= MAX_RUN_CHANGESETS) return
  const removeCount = entries.length - MAX_RUN_CHANGESETS
  for (let index = 0; index < removeCount; index += 1) {
    delete map[entries[index][0]]
  }
}

export function cacheRunChangeSet(
  map: Record<string, AgentRunChangeSet>,
  changeSet: AgentRunChangeSet,
  alias?: string | null
): void {
  map[changeSet.runId] = changeSet
  map[changeSet.assistantMessageId] = changeSet
  if (alias) {
    map[alias] = changeSet
  }
}

export function changeSetBelongsToSession(changeSet: AgentRunChangeSet, sessionId: string): boolean {
  return (
    changeSet.sessionId === sessionId ||
    changeSet.changes.some((change) => change.sessionId === sessionId)
  )
}

export function clearSessionRunChangeCache(
  map: Record<string, AgentRunChangeSet>,
  sessionId: string
): void {
  for (const [key, changeSet] of Object.entries(map)) {
    if (changeSetBelongsToSession(changeSet, sessionId)) {
      delete map[key]
    }
  }
}

export const sessionRunChangeRefreshInFlight = new Map<string, Promise<void>>()

export function ensureSessionToolCallCache(
  state: {
    sessionToolCallsCache: Record<string, SessionToolCallCache>
  },
  sessionId: string
): SessionToolCallCache {
  const existing = state.sessionToolCallsCache[sessionId]
  if (existing) return existing
  const created: SessionToolCallCache = { pending: [], executed: [] }
  state.sessionToolCallsCache[sessionId] = created
  return created
}

export function resolveSessionToolCallTarget(
  state: {
    liveSessionId: string | null
    pendingToolCalls: ToolCallState[]
    executedToolCalls: ToolCallState[]
    sessionToolCallsCache: Record<string, SessionToolCallCache>
  },
  sessionId?: string | null
): SessionToolCallCache {
  if (!sessionId || sessionId === state.liveSessionId) {
    return {
      pending: state.pendingToolCalls,
      executed: state.executedToolCalls
    }
  }
  return ensureSessionToolCallCache(state, sessionId)
}
