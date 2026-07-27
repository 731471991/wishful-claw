import { create } from 'zustand'
import { ipcClient } from '../lib/ipc/ipc-client'
import { invokeMessagePackBinary } from '../lib/ipc/messagepack-ipc-client'
import {
  DB_GOALS_LIST_MSGPACK_CHANNEL,
  DB_GOALS_GET_MSGPACK_CHANNEL,
  DB_GOAL_EVENTS_LIST_MSGPACK_CHANNEL,
  DB_GOALS_CREATE_MSGPACK_CHANNEL,
  DB_GOALS_SET_MSGPACK_CHANNEL,
  DB_GOALS_UPDATE_MSGPACK_CHANNEL,
  DB_GOALS_CLEAR_MSGPACK_CHANNEL,
  DB_GOALS_ACCOUNT_MSGPACK_CHANNEL,
  DB_GOAL_EVENTS_ADD_MSGPACK_CHANNEL,
} from '../../../shared/messagepack/binary-ipc'
import { upsertGoal, upsertGoalEvent, asGoal, mutationError, markGoalEventsIpcUnavailable, rowToGoal, rowToEvent, isGoalRow, EMPTY_SESSION_GOAL_EVENTS, isGoalEventsIpcUnavailable } from './goal-store-helpers'
export { EMPTY_SESSION_GOAL_EVENTS }

export const useGoalStore = create<GoalStore>((set, get) => ({
  goalsBySession: {},
  goalEventsBySession: {},
  activeGoalRunsBySession: {},
  _loaded: false,

  loadGoalsFromDb: async () => {
    try {
      const rows = await invokeMessagePackBinary<SessionGoalRow[]>(
        DB_GOALS_LIST_MSGPACK_CHANNEL,
        {}
      )
      const goalsBySession: Record<string, SessionGoal> = {}
      for (const row of rows) {
        const goal = rowToGoal(row)
        goalsBySession[goal.sessionId] = goal
      }
      set({ goalsBySession, _loaded: true })
    } catch (error) {
      console.error('[GoalStore] Failed to load goals:', error)
      set({ _loaded: true })
    }
  },

  loadGoalForSession: async (sessionId, force = false) => {
    const cached = get().goalsBySession[sessionId]
    if (cached && !force) return cached

    try {
      const row = await invokeMessagePackBinary<SessionGoalRow | null>(
        DB_GOALS_GET_MSGPACK_CHANNEL,
        sessionId
      )
      const goal = row ? rowToGoal(row) : undefined
      set((state) => {
        const next = { ...state.goalsBySession }
        if (goal) {
          next[sessionId] = goal
        } else {
          delete next[sessionId]
        }
        return { goalsBySession: next }
      })
      return goal
    } catch (error) {
      console.error('[GoalStore] Failed to load goal:', error)
      return cached
    }
  },

  loadGoalEventsForSession: async (sessionId, options = {}) => {
    const cached = get().goalEventsBySession[sessionId]
    if (cached && !options.force) return cached
    if (isGoalEventsIpcUnavailable()) return cached ?? EMPTY_SESSION_GOAL_EVENTS

    try {
      const rows = await invokeMessagePackBinary<SessionGoalEventRow[]>(
        DB_GOAL_EVENTS_LIST_MSGPACK_CHANNEL,
        {
          sessionId,
          goalId: options.goalId,
          limit: options.limit ?? 40
        }
      )
      const events = rows.map(rowToEvent)
      set((state) => ({
        goalEventsBySession: {
          ...state.goalEventsBySession,
          [sessionId]: events
        }
      }))
      return events
    } catch (error) {
      if (markGoalEventsIpcUnavailable(error)) {
        return cached ?? EMPTY_SESSION_GOAL_EVENTS
      }
      console.error('[GoalStore] Failed to load goal events:', error)
      return cached ?? EMPTY_SESSION_GOAL_EVENTS
    }
  },

  getGoalBySession: (sessionId) => get().goalsBySession[sessionId],
  getGoalEventsBySession: (sessionId) =>
    get().goalEventsBySession[sessionId] ?? EMPTY_SESSION_GOAL_EVENTS,

  createGoal: async (args) => {
    try {
      const result = await invokeMessagePackBinary<GoalMutationResult>(
        DB_GOALS_CREATE_MSGPACK_CHANNEL,
        args
      )
      if (result.error) return { success: false, error: result.error }
      const goal = asGoal(result)
      if (!goal) return { success: false, error: 'Goal was not created' }
      upsertGoal(set, goal)
      void get().loadGoalEventsForSession(goal.sessionId, { goalId: goal.goalId, force: true })
      return { success: true, goal }
    } catch (error) {
      return { success: false, error: mutationError(error) }
    }
  },

  setGoal: async (args) => {
    try {
      const result = await invokeMessagePackBinary<GoalMutationResult>(
        DB_GOALS_SET_MSGPACK_CHANNEL,
        args
      )
      if (result.error) return { success: false, error: result.error }
      const goal = asGoal(result)
      if (!goal) return { success: false, error: 'Goal was not set' }
      upsertGoal(set, goal)
      void get().loadGoalEventsForSession(goal.sessionId, { goalId: goal.goalId, force: true })
      return { success: true, goal }
    } catch (error) {
      return { success: false, error: mutationError(error) }
    }
  },

  updateGoal: async (sessionId, patch) => {
    try {
      const result = await invokeMessagePackBinary<GoalMutationResult>(
        DB_GOALS_UPDATE_MSGPACK_CHANNEL,
        {
          sessionId,
          patch
        }
      )
      if (result.error) return { success: false, error: result.error }
      const goal = asGoal(result)
      if (!goal) return { success: false, error: 'Goal was not updated' }
      upsertGoal(set, goal)
      void get().loadGoalEventsForSession(goal.sessionId, { goalId: goal.goalId, force: true })
      return { success: true, goal }
    } catch (error) {
      return { success: false, error: mutationError(error) }
    }
  },

  clearGoal: async (sessionId) => {
    try {
      const result = await invokeMessagePackBinary<GoalMutationResult>(
        DB_GOALS_CLEAR_MSGPACK_CHANNEL,
        sessionId
      )
      if (result.error) return { success: false, cleared: false, error: result.error }
      set((state) => {
        const next = { ...state.goalsBySession }
        delete next[sessionId]
        return { goalsBySession: next }
      })
      void get().loadGoalEventsForSession(sessionId, { force: true })
      return { success: true, cleared: result.cleared === true }
    } catch (error) {
      return { success: false, cleared: false, error: mutationError(error) }
    }
  },

  accountGoalUsage: async (input) => {
    try {
      const result = await invokeMessagePackBinary<GoalMutationResult>(
        DB_GOALS_ACCOUNT_MSGPACK_CHANNEL,
        input
      )
      if (result.error) return { success: false, error: result.error }
      const goal = asGoal(result)
      if (goal) upsertGoal(set, goal)
      if (goal) {
        void get().loadGoalEventsForSession(goal.sessionId, { goalId: goal.goalId, force: true })
      }
      return { success: true, ...(goal ? { goal } : {}) }
    } catch (error) {
      return { success: false, error: mutationError(error) }
    }
  },

  addGoalEvent: async (args) => {
    if (isGoalEventsIpcUnavailable()) {
      return { success: false, error: 'Goal event IPC is unavailable until Electron restarts' }
    }

    try {
      const result = await invokeMessagePackBinary<GoalEventMutationResult>(
        DB_GOAL_EVENTS_ADD_MSGPACK_CHANNEL,
        args
      )
      if (result.error) return { success: false, error: result.error }
      if (!result.event) return { success: false, error: 'Goal event was not recorded' }
      const event = rowToEvent(result.event)
      upsertGoalEvent(set, event)
      return { success: true, event }
    } catch (error) {
      if (markGoalEventsIpcUnavailable(error)) {
        return { success: false, error: 'Goal event IPC is unavailable until Electron restarts' }
      }
      return { success: false, error: mutationError(error) }
    }
  },

  startGoalRun: (sessionId, goalId, startedAt = Date.now()) => {
    set((state) => ({
      activeGoalRunsBySession: {
        ...state.activeGoalRunsBySession,
        [sessionId]: { goalId, startedAt }
      }
    }))
  },

  finishGoalRun: (sessionId, goalId) => {
    set((state) => {
      const existing = state.activeGoalRunsBySession[sessionId]
      if (!existing) return {}
      if (goalId && existing.goalId !== goalId) return {}
      const next = { ...state.activeGoalRunsBySession }
      delete next[sessionId]
      return { activeGoalRunsBySession: next }
    })
  },

  applySyncedGoal: (goal) => {
    upsertGoal(set, goal)
    void get().loadGoalEventsForSession(goal.sessionId, { goalId: goal.goalId, force: true })
  },

  applySyncedGoalClear: (sessionId) => {
    set((state) => {
      const next = { ...state.goalsBySession }
      const nextActiveRuns = { ...state.activeGoalRunsBySession }
      delete next[sessionId]
      delete nextActiveRuns[sessionId]
      return { goalsBySession: next, activeGoalRunsBySession: nextActiveRuns }
    })
    void get().loadGoalEventsForSession(sessionId, { force: true })
  },

  applySyncedGoalEvent: (event) => {
    upsertGoalEvent(set, event)
  }
}))

export function installGoalSyncListener(): () => void {
  const offUpdated = ipcClient.on('goal:updated', (payload: unknown) => {
    const row =
      payload && typeof payload === 'object' ? (payload as { goal?: SessionGoalRow }).goal : null
    if (!row) return
    useGoalStore.getState().applySyncedGoal(rowToGoal(row))
  })

  const offCleared = ipcClient.on('goal:cleared', (payload: unknown) => {
    const sessionId =
      payload && typeof payload === 'object'
        ? (payload as { sessionId?: unknown }).sessionId
        : undefined
    if (typeof sessionId === 'string') {
      useGoalStore.getState().applySyncedGoalClear(sessionId)
    }
  })

  const offEventAdded = ipcClient.on('goal:event-added', (payload: unknown) => {
    const row =
      payload && typeof payload === 'object'
        ? (payload as { event?: SessionGoalEventRow }).event
        : null
    if (!row) return
    useGoalStore.getState().applySyncedGoalEvent(rowToEvent(row))
  })

  const offRunState = ipcClient.on('goal:run-state', (payload: unknown) => {
    const record =
      payload && typeof payload === 'object'
        ? (payload as {
            sessionId?: unknown
            active?: unknown
            goalId?: unknown
            startedAt?: unknown
          })
        : null
    const sessionId = typeof record?.sessionId === 'string' ? record.sessionId : ''
    if (!sessionId) return
    if (record?.active === true && typeof record.goalId === 'string' && record.goalId.trim()) {
      useGoalStore
        .getState()
        .startGoalRun(
          sessionId,
          record.goalId.trim(),
          typeof record.startedAt === 'number' ? record.startedAt : Date.now()
        )
      return
    }
    useGoalStore
      .getState()
      .finishGoalRun(sessionId, typeof record?.goalId === 'string' ? record.goalId : undefined)
  })

  return () => {
    offUpdated()
    offCleared()
    offEventAdded()
    offRunState()
  }
}

export type { SessionGoal, SessionGoalEvent, SessionGoalEventType } from "./goal-store-helpers"
