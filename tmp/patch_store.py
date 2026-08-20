p = 'src/renderer/src/stores/goal-history-store.ts'
s = open(p, encoding='utf-8').read()

def rep(a, b):
    global s
    assert s.count(a) == 1, f"match {s.count(a)}: {a[:60]}"
    s = s.replace(a, b)

rep("""import {
  DB_GOALS_LIST_PAGE_MSGPACK_CHANNEL,
  DB_GOAL_EVENTS_LIST_PAGE_MSGPACK_CHANNEL
} from '@shared/messagepack/binary-ipc'""",
"""import {
  DB_GOALS_LIST_PAGE_MSGPACK_CHANNEL,
  DB_GOAL_EVENTS_LIST_PAGE_MSGPACK_CHANNEL,
  DB_GOAL_PLAN_TASKS_LIST_MSGPACK_CHANNEL
} from '@shared/messagepack/binary-ipc'""")

rep("""import {
  mutationError,
  rowToEvent,
  rowToGoal,
  type GoalEventPageResult,
  type GoalPageResult,
  type SessionGoal,
  type SessionGoalEvent
} from './goal-store-helpers'""",
"""import {
  mutationError,
  rowToEvent,
  rowToGoal,
  rowToPlanTask,
  type GoalEventPageResult,
  type GoalPageResult,
  type SessionGoal,
  type SessionGoalEvent,
  type SessionGoalPlanTask,
  type SessionGoalPlanTaskRow
} from './goal-store-helpers'""")

rep("  eventsByGoal: Record<string, SessionGoalEvent[]>",
    "  eventsByGoal: Record<string, SessionGoalEvent[]>\n  planTasksByGoal: Record<string, SessionGoalPlanTask[]>")

rep("""  loadMoreGoalEvents: (sessionId: string, goalId: string) => Promise<SessionGoalEvent[]>
}""",
"""  loadMoreGoalEvents: (sessionId: string, goalId: string) => Promise<SessionGoalEvent[]>
  loadGoalPlanTasks: (sessionId: string, goalId: string, force?: boolean) => Promise<SessionGoalPlanTask[]>
}""")

rep("""  goalsByProject: {},
  eventsByGoal: {},""",
"""  goalsByProject: {},
  eventsByGoal: {},
  planTasksByGoal: {},""")

impl = """
  loadGoalPlanTasks: async (sessionId, goalId, force = false) => {
    const key = goalHistoryKey(sessionId, goalId)
    const cached = get().planTasksByGoal[key]
    if (cached && !force) return cached

    set((state) => ({ loadingGoals: { ...state.loadingGoals, [key]: true } }))
    try {
      const rows = await invokeMessagePackBinary<SessionGoalPlanTaskRow[]>(
        DB_GOAL_PLAN_TASKS_LIST_MSGPACK_CHANNEL,
        { sessionId, goalId }
      )
      const tasks = (rows ?? []).map(rowToPlanTask)
      set((state) => ({
        planTasksByGoal: { ...state.planTasksByGoal, [key]: tasks },
        loadingGoals: { ...state.loadingGoals, [key]: false }
      }))
      return tasks
    } catch {
      set((state) => ({ loadingGoals: { ...state.loadingGoals, [key]: false } }))
      return cached ?? []
    }
  },
"""
idx = s.rstrip().rfind('}))')
assert idx > 0
s = s[:idx] + impl + s[idx:]

open(p, 'w', encoding='utf-8', newline='').write(s)
print('OK')
