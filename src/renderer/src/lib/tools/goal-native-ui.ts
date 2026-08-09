import { useGoalStore } from '@renderer/stores/goal-store'

// Goal confirmation reverse request (like plan review).
// The agent calls create_goal, which sends a goal/confirm-request reverse request
// to the renderer. The renderer shows the confirmation card and waits
// for the user to confirm or discard. The response goes back to the agent.

export interface GoalConfirmResponse {
  confirmed: boolean
}

const goalConfirmResolvers = new Map<string, (payload: GoalConfirmResponse) => void>()

export function resolveGoalConfirm(goalId: string, confirmed: boolean): void {
  const resolve = goalConfirmResolvers.get(goalId)
  if (resolve) {
    resolve({ confirmed })
    goalConfirmResolvers.delete(goalId)
  }
}

export function cancelGoalConfirm(goalId: string): void {
  const resolve = goalConfirmResolvers.get(goalId)
  if (resolve) {
    resolve({ confirmed: false })
    goalConfirmResolvers.delete(goalId)
  }
}

export async function handleNativeGoalConfirmRequest(params: unknown): Promise<GoalConfirmResponse> {
  const record = params && typeof params === 'object' ? (params as Record<string, unknown>) : {}
  const goalId = typeof record.goalId === 'string' ? record.goalId : undefined
  const sessionId = typeof record.sessionId === 'string' ? record.sessionId : undefined
  const objective = typeof record.objective === 'string' ? record.objective : ''
  const status = typeof record.status === 'string' ? record.status : 'pending'

  if (!goalId || !sessionId) {
    return { confirmed: false }
  }

  // Store the pending goal info in the goal store so the GoalSessionBar can show it
  useGoalStore.getState().applyGoalProgress({
    sessionId,
    goalId,
    objective,
    eventType: 'GoalPending',
    message: `Goal created: ${objective}. Awaiting your confirmation.`,
    status,
    currentPlanIndex: -1,
    planCount: 0,
    completedPlans: 0,
    timestamp: Date.now()
  })

  // Open the right panel to show the goal confirmation card
  const { useUIStore } = await import('@renderer/stores/ui-store')
  useUIStore.getState().openGoalPanel(sessionId)

  // Wait for user to confirm or discard
  return await new Promise<GoalConfirmResponse>((resolve) => {
    const previous = goalConfirmResolvers.get(goalId)
    if (previous) {
      previous({ confirmed: false })
    }
    goalConfirmResolvers.set(goalId, resolve)
  })
}