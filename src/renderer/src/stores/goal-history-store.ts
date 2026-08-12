import { create } from 'zustand'
import {
  DB_GOALS_LIST_MSGPACK_CHANNEL,
  DB_GOAL_EVENTS_LIST_MSGPACK_CHANNEL
} from '@shared/messagepack/binary-ipc'
import { invokeMessagePackBinary } from '@renderer/lib/ipc/messagepack-ipc-client'
import {
  mutationError,
  rowToEvent,
  rowToGoal,
  type SessionGoal,
  type SessionGoalEvent,
  type SessionGoalEventRow,
  type SessionGoalRow
} from './goal-store-helpers'
import { applyGoalStatusToProjects } from './goal-state-transitions'

interface GoalHistoryState {
  goalsByProject: Record<string, SessionGoal[]>
  eventsByGoal: Record<string, SessionGoalEvent[]>
  loadingProjects: Record<string, boolean>
  loadingGoals: Record<string, boolean>
  errorsByProject: Record<string, string | undefined>
  applyGoalSnapshot: (goal: SessionGoal) => void
  applyGoalStatus: (
    projectId: string | null | undefined,
    sessionId: string,
    goalId: string,
    status: SessionGoal['status'],
    updatedAt: number
  ) => void
  refreshLoadedProjects: () => void
  loadProjectGoals: (projectId: string | null, force?: boolean) => Promise<SessionGoal[]>
  loadGoalEvents: (
    sessionId: string,
    goalId: string,
    force?: boolean
  ) => Promise<SessionGoalEvent[]>
}

export function goalProjectKey(projectId: string | null): string {
  return projectId ?? '__global__'
}

export function goalHistoryKey(sessionId: string, goalId: string): string {
  return `${sessionId}\u0000${goalId}`
}

export const useGoalHistoryStore = create<GoalHistoryState>((set, get) => ({
  goalsByProject: {},
  eventsByGoal: {},
  loadingProjects: {},
  loadingGoals: {},
  errorsByProject: {},

  applyGoalSnapshot: (goal) => {
    const key = goalProjectKey(goal.projectId ?? null)
    set((state) => {
      const current = state.goalsByProject[key]
      if (!current) return {}
      const goals = [goal, ...current.filter((item) => item.goalId !== goal.goalId)]
        .sort((a, b) => {
          const aCurrent = a.status === 'pending' || a.status === 'active' ? 1 : 0
          const bCurrent = b.status === 'pending' || b.status === 'active' ? 1 : 0
          return bCurrent - aCurrent || b.updatedAt - a.updatedAt
        })
      return { goalsByProject: { ...state.goalsByProject, [key]: goals } }
    })
  },

  applyGoalStatus: (projectId, sessionId, goalId, status, updatedAt) => {
    set((state) => {
      const keys = projectId === undefined
        ? Object.keys(state.goalsByProject)
        : [goalProjectKey(projectId)]
      const goalsByProject = applyGoalStatusToProjects(
        state.goalsByProject,
        keys,
        sessionId,
        goalId,
        status,
        updatedAt
      )
      return goalsByProject === state.goalsByProject ? {} : { goalsByProject }
    })
  },

  refreshLoadedProjects: () => {
    for (const key of Object.keys(get().goalsByProject)) {
      void get().loadProjectGoals(key === '__global__' ? null : key, true)
    }
  },

  loadProjectGoals: async (projectId, force = false) => {
    const key = goalProjectKey(projectId)
    const cached = get().goalsByProject[key]
    if (cached && !force) return cached

    set((state) => ({
      loadingProjects: { ...state.loadingProjects, [key]: true },
      errorsByProject: { ...state.errorsByProject, [key]: undefined }
    }))
    try {
      const rows = await invokeMessagePackBinary<SessionGoalRow[]>(
        DB_GOALS_LIST_MSGPACK_CHANNEL,
        { projectId }
      )
      const goals = rows.map(rowToGoal)
      set((state) => ({
        goalsByProject: { ...state.goalsByProject, [key]: goals },
        loadingProjects: { ...state.loadingProjects, [key]: false }
      }))
      return goals
    } catch (error) {
      const message = mutationError(error)
      set((state) => ({
        loadingProjects: { ...state.loadingProjects, [key]: false },
        errorsByProject: { ...state.errorsByProject, [key]: message }
      }))
      return cached ?? []
    }
  },

  loadGoalEvents: async (sessionId, goalId, force = false) => {
    const key = goalHistoryKey(sessionId, goalId)
    const cached = get().eventsByGoal[key]
    if (cached && !force) return cached

    set((state) => ({ loadingGoals: { ...state.loadingGoals, [key]: true } }))
    try {
      const rows = await invokeMessagePackBinary<SessionGoalEventRow[]>(
        DB_GOAL_EVENTS_LIST_MSGPACK_CHANNEL,
        { sessionId, goalId, limit: 200 }
      )
      const events = rows.map(rowToEvent)
      set((state) => ({
        eventsByGoal: { ...state.eventsByGoal, [key]: events },
        loadingGoals: { ...state.loadingGoals, [key]: false }
      }))
      return events
    } catch {
      set((state) => ({ loadingGoals: { ...state.loadingGoals, [key]: false } }))
      return cached ?? []
    }
  }
}))
