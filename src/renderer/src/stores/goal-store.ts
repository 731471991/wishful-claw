import { create } from 'zustand'
import { ipcClient } from '../lib/ipc/ipc-client'
import { useGoalHistoryStore } from './goal-history-store'
import { invokeMessagePackBinary } from '../lib/ipc/messagepack-ipc-client'
import {
  DB_GOALS_LIST_MSGPACK_CHANNEL,
  DB_GOALS_GET_MSGPACK_CHANNEL,
  DB_GOAL_EVENTS_LIST_MSGPACK_CHANNEL,
  DB_GOALS_CREATE_MSGPACK_CHANNEL,
  DB_GOALS_SET_MSGPACK_CHANNEL,
  DB_GOALS_UPDATE_MSGPACK_CHANNEL,
  DB_GOALS_ACCOUNT_MSGPACK_CHANNEL,
  DB_GOAL_EVENTS_ADD_MSGPACK_CHANNEL,
  GOAL_ABORT_MSGPACK_CHANNEL,
  GOAL_CONFIRM_MSGPACK_CHANNEL,
} from '../../../shared/messagepack/binary-ipc'
import { upsertGoal, upsertGoalEvent, asGoal, mutationError, markGoalEventsIpcUnavailable, rowToGoal, rowToEvent, EMPTY_SESSION_GOAL_EVENTS, isGoalEventsIpcUnavailable, GoalActionResult, GoalEventMutationResult, GoalMutationResult, GoalStore, SessionGoalEventRow, SessionGoalRow } from './goal-store-helpers'
export { EMPTY_SESSION_GOAL_EVENTS }

function removeRuntimeGoal(
  state: GoalStore,
  sessionId: string,
  goalId: string
): Partial<GoalStore> {
  const existingGoal = state.goalsBySession[sessionId]
  const existingProgress = state.goalProgressBySession[sessionId]
  const existingRun = state.activeGoalRunsBySession[sessionId]
  const goalsBySession = { ...state.goalsBySession }
  const goalProgressBySession = { ...state.goalProgressBySession }
  const goalRunStatesBySession = { ...state.goalRunStatesBySession }
  const activeGoalRunsBySession = { ...state.activeGoalRunsBySession }

  if (existingGoal?.goalId === goalId) delete goalsBySession[sessionId]
  if (existingProgress?.goalId === goalId) {
    delete goalProgressBySession[sessionId]
    delete goalRunStatesBySession[sessionId]
  }
  if (existingRun?.goalId === goalId) delete activeGoalRunsBySession[sessionId]

  return {
    goalsBySession,
    goalProgressBySession,
    goalRunStatesBySession,
    activeGoalRunsBySession
  }
}

export const useGoalStore = create<GoalStore>((set, get) => ({
  goalsBySession: {},
  goalEventsBySession: {},
  activeGoalRunsBySession: {},
  goalProgressBySession: {},
  goalRunStatesBySession: {},
  _loaded: false,

  loadGoalsFromDb: async () => {
    try {
      const rows = await invokeMessagePackBinary<SessionGoalRow[]>(
        DB_GOALS_LIST_MSGPACK_CHANNEL,
        {}
      )
      const goalsBySession: Record<string, ReturnType<typeof rowToGoal>> = {}
      for (const row of rows) {
        if (row.status !== 'pending' && row.status !== 'active') continue
        const goal = rowToGoal(row)
        if (!goalsBySession[goal.sessionId]) {
          goalsBySession[goal.sessionId] = goal
        }
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
      const result = await invokeMessagePackBinary<GoalMutationResult | SessionGoalRow | null>(
        DB_GOALS_GET_MSGPACK_CHANNEL,
        sessionId
      )
      const goal = asGoal(result) ?? undefined
      set((state) => {
        const next = { ...state.goalsBySession }
        const nextActiveRuns = { ...state.activeGoalRunsBySession }
        if (goal) {
          next[sessionId] = goal
          // 从 DB 加载的 goal 默认是未运行（idle）状态，不设置 activeRun。
          // 真正开始时由 goal_progress 事件（runState= running）驱动。
          delete nextActiveRuns[sessionId]
        } else {
          delete next[sessionId]
          delete nextActiveRuns[sessionId]
        }
        return { goalsBySession: next, activeGoalRunsBySession: nextActiveRuns }
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
      const goalId = get().goalsBySession[sessionId]?.goalId
      if (!goalId) return { success: false, error: 'Goal not found' }
      const result = await invokeMessagePackBinary<GoalMutationResult>(
        DB_GOALS_UPDATE_MSGPACK_CHANNEL,
        {
          sessionId,
          goalId,
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

  confirmGoal: async (sessionId, goalId) => {
    try {
      const result = await invokeMessagePackBinary<{ success: boolean; error?: string }>(
        GOAL_CONFIRM_MSGPACK_CHANNEL,
        { sessionId, goalId }
      )
      if (result.success) {
        // Optimistically flip the goal to active so the banner transitions immediately.
        // The orchestrator's goal_progress events will keep it in sync afterwards.
        const existing = get().goalsBySession[sessionId]
        useGoalHistoryStore.getState().applyGoalStatus(
          existing?.projectId,
          sessionId,
          goalId,
          'active',
          Date.now()
        )
        set((state) => {
          const existing = state.goalsBySession[sessionId]
          if (!existing) return {}
          return {
            goalsBySession: {
              ...state.goalsBySession,
              [sessionId]: { ...existing, status: 'active' }
            }
          }
        })
      }
      return { success: result.success, error: result.error }
    } catch (error) {
      return { success: false, error: mutationError(error) }
    }
  },

  cancelGoal: async (sessionId, requestedGoalId) => {
    try {
      const currentGoal = get().goalsBySession[sessionId]
      const goalId = requestedGoalId ?? currentGoal?.goalId
      if (!goalId) return { success: false, error: 'Goal not found' }
      const result = await invokeMessagePackBinary<GoalActionResult>(
        GOAL_ABORT_MSGPACK_CHANNEL,
        { sessionId, goalId }
      )
      if (!result.success || result.error) {
        return { success: false, error: result.error ?? 'Goal was not cancelled' }
      }
      set((state) => removeRuntimeGoal(state, sessionId, goalId))
      useGoalHistoryStore.getState().applyGoalStatus(
        currentGoal?.projectId,
        sessionId,
        goalId,
        'aborted',
        Date.now()
      )
      return { success: true }
    } catch (error) {
      return { success: false, error: mutationError(error) }
    }
  },

  accountGoalUsage: async (input) => {
    try {
      const goalId = input.expectedGoalId ?? get().goalsBySession[input.sessionId]?.goalId
      if (!goalId) return { success: false, error: 'Goal not found' }
      const result = await invokeMessagePackBinary<GoalMutationResult>(
        DB_GOALS_ACCOUNT_MSGPACK_CHANNEL,
        { ...input, goalId }
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
    useGoalHistoryStore.getState().applyGoalSnapshot(goal)
    if (goal.status === 'complete' || goal.status === 'failed' || goal.status === 'aborted') {
      set((state) => removeRuntimeGoal(state, goal.sessionId, goal.goalId))
      return
    }
    upsertGoal(set, goal)
    void get().loadGoalEventsForSession(goal.sessionId, { goalId: goal.goalId, force: true })
  },

  applySyncedGoalEvent: (event) => {
    const currentGoal = get().goalsBySession[event.sessionId]
    if (!currentGoal || event.goalId !== currentGoal.goalId) return
    upsertGoalEvent(set, event)
  },

  applyGoalProgress: (progress) => {
    set((state) => {
      const terminal = progress.status === 'complete'
        || progress.status === 'failed'
        || progress.status === 'aborted'
      const goalsBySession = { ...state.goalsBySession }
      const goalProgressBySession = { ...state.goalProgressBySession }
      const goalRunStatesBySession = { ...state.goalRunStatesBySession }
      const activeGoalRunsBySession = { ...state.activeGoalRunsBySession }
      const existingGoal = goalsBySession[progress.sessionId]

      if (!existingGoal && progress.status === 'pending') {
        useGoalHistoryStore.getState().refreshLoadedProjects()
      }
      if (progress.status) {
        useGoalHistoryStore.getState().applyGoalStatus(
          existingGoal?.projectId,
          progress.sessionId,
          progress.goalId,
          progress.status as typeof existingGoal.status,
          progress.timestamp
        )
      }

      if (existingGoal && existingGoal.goalId === progress.goalId && progress.status) {
        goalsBySession[progress.sessionId] = {
          ...existingGoal,
          status: progress.status as typeof existingGoal.status,
          updatedAt: progress.timestamp
        }
      }

      if (terminal) {
        if (existingGoal?.goalId === progress.goalId) {
          delete goalsBySession[progress.sessionId]
        }
        if (goalProgressBySession[progress.sessionId]?.goalId === progress.goalId) {
          delete goalProgressBySession[progress.sessionId]
          delete goalRunStatesBySession[progress.sessionId]
        }
        if (activeGoalRunsBySession[progress.sessionId]?.goalId === progress.goalId) {
          delete activeGoalRunsBySession[progress.sessionId]
        }
      } else {
        goalProgressBySession[progress.sessionId] = progress
        if (progress.runState) {
          goalRunStatesBySession[progress.sessionId] = progress.runState
          if (progress.runState === 'running') {
            const activeRun = activeGoalRunsBySession[progress.sessionId]
            if (!activeRun || activeRun.goalId !== progress.goalId) {
              activeGoalRunsBySession[progress.sessionId] = {
                goalId: progress.goalId,
                startedAt: Date.now()
              }
            }
          } else {
            delete activeGoalRunsBySession[progress.sessionId]
          }
        }
      }

      return {
        goalsBySession,
        goalProgressBySession,
        goalRunStatesBySession,
        activeGoalRunsBySession
      }
    })
  },
  clearGoalProgress: (sessionId: string, goalId?: string | null) => {
    set((state) => {
      const existing = state.goalProgressBySession[sessionId]
      if (!existing || (goalId && existing.goalId !== goalId)) return {}
      const next = { ...state.goalProgressBySession }
      delete next[sessionId]
      return { goalProgressBySession: next }
    })
  }
}))

export function installGoalSyncListener(): () => void {
  const offUpdated = ipcClient.on('goal:updated', (payload: unknown) => {
    const row =
      payload && typeof payload === 'object' ? (payload as { goal?: SessionGoalRow }).goal : null
    if (!row) return
    useGoalStore.getState().applySyncedGoal(rowToGoal(row))
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
    offEventAdded()
    offRunState()
  }
}

export type { GoalRunState, SessionGoal, SessionGoalEvent, SessionGoalEventType, SessionGoalStatus } from "./goal-store-helpers"
