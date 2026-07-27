import { create } from 'zustand'
import { ipcClient } from '../lib/ipc/ipc-client'
import { invokeMessagePackBinary } from '../lib/ipc/messagepack-ipc-client'
import {
  DB_GOALS_ACCOUNT_MSGPACK_CHANNEL,
  DB_GOALS_CLEAR_MSGPACK_CHANNEL,
  DB_GOALS_CREATE_MSGPACK_CHANNEL,
  DB_GOALS_GET_MSGPACK_CHANNEL,
  DB_GOALS_LIST_MSGPACK_CHANNEL,
  DB_GOALS_SET_MSGPACK_CHANNEL,
  DB_GOALS_UPDATE_MSGPACK_CHANNEL,
  DB_GOAL_EVENTS_ADD_MSGPACK_CHANNEL,
  DB_GOAL_EVENTS_LIST_MSGPACK_CHANNEL
} from '../../../shared/messagepack/binary-ipc'

export type SessionGoalStatus =
  | 'active'
  | 'paused'
  | 'blocked'
  | 'usage_limited'
  | 'budget_limited'
  | 'complete'
export type SessionGoalEventType =
  | 'created'
  | 'replaced'
  | 'objective_updated'
  | 'budget_updated'
  | 'status_changed'
  | 'usage_accounted'
  | 'usage_limited'
  | 'budget_limited'
  | 'completion_deferred'
  | 'blocked'
  | 'completed'
  | 'stall_paused'
  | 'auto_continue_blocked'
  | 'cleared'

export interface SessionGoal {
  sessionId: string
  goalId: string
  objective: string
  status: SessionGoalStatus
  tokenBudget?: number | null
  tokensUsed: number
  timeUsedSeconds: number
  createdAt: number
  updatedAt: number
}

export interface SessionGoalEvent {
  id: string
  sessionId: string
  goalId?: string | null
  eventType: SessionGoalEventType
  message?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: number
}

export interface ActiveGoalRun {
  goalId: string
  startedAt: number
}

export const EMPTY_SESSION_GOAL_EVENTS: SessionGoalEvent[] = []

interface SessionGoalRow {
  session_id: string
  goal_id: string
  objective: string
  status: SessionGoalStatus
  token_budget: number | null
  tokens_used: number
  time_used_seconds: number
  created_at: number
  updated_at: number
}

interface SessionGoalEventRow {
  id: string
  session_id: string
  goal_id: string | null
  event_type: SessionGoalEventType
  message: string | null
  metadata_json: string | null
  created_at: number
}

interface GoalMutationResult {
  success?: boolean
  error?: string
  goal?: SessionGoalRow | null
  cleared?: boolean
}

interface GoalEventMutationResult {
  success?: boolean
  error?: string
  event?: SessionGoalEventRow | null
}

interface AccountGoalUsageInput {
  sessionId: string
  timeDeltaSeconds: number
  tokenDelta: number
  expectedGoalId?: string | null
}

interface GoalStore {
  goalsBySession: Record<string, SessionGoal>
  goalEventsBySession: Record<string, SessionGoalEvent[]>
  activeGoalRunsBySession: Record<string, ActiveGoalRun>
  _loaded: boolean

  loadGoalsFromDb: () => Promise<void>
  loadGoalForSession: (sessionId: string, force?: boolean) => Promise<SessionGoal | undefined>
  loadGoalEventsForSession: (
    sessionId: string,
    options?: { goalId?: string | null; limit?: number; force?: boolean }
  ) => Promise<SessionGoalEvent[]>
  getGoalBySession: (sessionId: string) => SessionGoal | undefined
  getGoalEventsBySession: (sessionId: string) => SessionGoalEvent[]
  createGoal: (args: {
    sessionId: string
    objective: string
    tokenBudget?: number | null
  }) => Promise<{ success: boolean; goal?: SessionGoal; error?: string }>
  setGoal: (args: {
    sessionId: string
    objective: string
    status?: SessionGoalStatus
    tokenBudget?: number | null
  }) => Promise<{ success: boolean; goal?: SessionGoal; error?: string }>
  updateGoal: (
    sessionId: string,
    patch: Partial<Pick<SessionGoal, 'objective' | 'status' | 'tokenBudget'>>
  ) => Promise<{ success: boolean; goal?: SessionGoal; error?: string }>
  clearGoal: (sessionId: string) => Promise<{ success: boolean; cleared: boolean; error?: string }>
  accountGoalUsage: (
    input: AccountGoalUsageInput
  ) => Promise<{ success: boolean; goal?: SessionGoal; error?: string }>
  addGoalEvent: (args: {
    sessionId: string
    goalId?: string | null
    eventType: SessionGoalEventType
    message?: string | null
    metadata?: Record<string, unknown> | null
  }) => Promise<{ success: boolean; event?: SessionGoalEvent; error?: string }>
  startGoalRun: (sessionId: string, goalId: string, startedAt?: number) => void
  finishGoalRun: (sessionId: string, goalId?: string | null) => void
  applySyncedGoal: (goal: SessionGoal) => void
  applySyncedGoalClear: (sessionId: string) => void
  applySyncedGoalEvent: (event: SessionGoalEvent) => void
}

export function rowToGoal(row: SessionGoalRow): SessionGoal {
  return {
    sessionId: row.session_id,
    goalId: row.goal_id,
    objective: row.objective,
    status: row.status,
    tokenBudget: row.token_budget,
    tokensUsed: row.tokens_used,
    timeUsedSeconds: row.time_used_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function rowToEvent(row: SessionGoalEventRow): SessionGoalEvent {
  let metadata: Record<string, unknown> | null = null
  if (row.metadata_json) {
    try {
      const parsed = JSON.parse(row.metadata_json)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        metadata = parsed as Record<string, unknown>
      }
    } catch {
      metadata = null
    }
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    goalId: row.goal_id,
    eventType: row.event_type,
    message: row.message,
    metadata,
    createdAt: row.created_at
  }
}

export function isGoalRow(value: GoalMutationResult | SessionGoalRow): value is SessionGoalRow {
  return 'session_id' in value
}

export function asGoal(
  result: GoalMutationResult | SessionGoalRow | null | undefined
): SessionGoal | null {
  if (!result) return null
  const row = isGoalRow(result) ? result : result.goal
  return row ? rowToGoal(row) : null
}

export function mutationError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

let _goalEventsIpcUnavailable = false
let goalEventsIpcUnavailableWarned = false

export function isGoalEventsIpcUnavailable(): boolean { return _goalEventsIpcUnavailable }
export function markGoalEventsIpcUnavailable(error: unknown): boolean {
  const message = mutationError(error)
  if (!message.includes('No handler registered') || !message.includes('db:goal-events')) {
    return false
  }

  _goalEventsIpcUnavailable = true
  if (!goalEventsIpcUnavailableWarned) {
    goalEventsIpcUnavailableWarned = true
    console.warn(
      '[GoalStore] Goal event IPC is unavailable. Restart Electron to enable goal event history.'
    )
  }
  return true
}

type GoalStoreSetter = (
  partial: Partial<GoalStore> | ((state: GoalStore) => Partial<GoalStore>)
) => void

export function upsertGoal(setState: GoalStoreSetter, goal: SessionGoal): void {
  setState((state) => ({
    goalsBySession: {
      ...state.goalsBySession,
      [goal.sessionId]: goal
    }
  }))
}

export function upsertGoalEvent(setState: GoalStoreSetter, event: SessionGoalEvent): void {
  setState((state) => {
    const existing = state.goalEventsBySession[event.sessionId] ?? []
    const next = [event, ...existing.filter((item) => item.id !== event.id)]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50)
    return {
      goalEventsBySession: {
        ...state.goalEventsBySession,
        [event.sessionId]: next
      }
    }
  })
}

