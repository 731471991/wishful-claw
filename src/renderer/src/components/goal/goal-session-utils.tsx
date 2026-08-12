import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import { formatGoalElapsedSeconds, formatGoalTokens, goalStatusLabel } from '@renderer/lib/agent/goal-context'
import {
  EMPTY_SESSION_GOAL_EVENTS,
  useGoalStore,
  type SessionGoal,
  type SessionGoalEvent,
} from '@renderer/stores/goal-store'



export function eventMetadataNumber(event: SessionGoalEvent, key: string): number | null {
  const value = event.metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function eventMetadataString(event: SessionGoalEvent, key: string): string | null {
  const value = event.metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function useGoalSession(sessionId?: string | null): {
  goal: SessionGoal | undefined
  events: SessionGoalEvent[]
  runState: string | undefined
} {
  const goal = useGoalStore((s) => (sessionId ? s.goalsBySession[sessionId] : undefined))
  const progress = useGoalStore((s) => (sessionId ? s.goalProgressBySession[sessionId] : undefined))
  const runState = useGoalStore((s) => (sessionId ? s.goalRunStatesBySession[sessionId] : undefined))
  const events = useGoalStore((s) =>
    sessionId
      ? (s.goalEventsBySession[sessionId] ?? EMPTY_SESSION_GOAL_EVENTS)
      : EMPTY_SESSION_GOAL_EVENTS
  )

  // Fallback: when orchestrator is running but DB goal not yet available,
  // construct a synthetic goal from progress data
  const fallbackGoal: SessionGoal | undefined = React.useMemo(() => {
    if (!progress || goal) return undefined
    return {
      sessionId: progress.sessionId,
      goalId: progress.goalId,
      objective: progress.objective ?? '',
      status: (progress.status as SessionGoal['status']) || 'active',
      createdAt: progress.timestamp,
      updatedAt: progress.timestamp,
      tokensUsed: 0,
      timeUsedSeconds: 0,
      plans: [],
      workingFolder: null
    }
  }, [progress, goal])

  React.useEffect(() => {
    if (!sessionId) return
    void useGoalStore.getState().loadGoalForSession(sessionId, true)
  }, [sessionId])

  React.useEffect(() => {
    if (!sessionId) return
    void useGoalStore
      .getState()
      .loadGoalEventsForSession(sessionId, { goalId: goal?.goalId, force: true })
  }, [sessionId, goal?.goalId])

  return { goal: goal ?? fallbackGoal, events, runState }
}

export function statusTone(status?: SessionGoal['status']): string {
  switch (status) {
    case 'pending':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300'
    case 'active':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
    case 'paused':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300'
    case 'blocked':
      return 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300'
    case 'usage_limited':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300'
    case 'budget_limited':
      return 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300'
    case 'complete':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300'
    default:
      return 'border-border/70 bg-muted/30 text-muted-foreground'
  }
}

export function GoalStatusBadge({ status }: { status?: SessionGoal['status'] }): React.JSX.Element {
  const { t } = useTranslation('chat')
  const fallback = status ? goalStatusLabel(status) : 'not set'
  return (
    <span className={cn('rounded border px-1.5 py-0.5 text-[10px]', statusTone(status))}>
      {status ? t(`goal.status.${status}`, { defaultValue: fallback }) : t('goal.notSet')}
    </span>
  )
}

export function GoalUsageLine({
  goal,
  timeUsedSeconds
}: {
  goal?: SessionGoal
  timeUsedSeconds?: number
}): React.JSX.Element {
  const { t } = useTranslation('chat')
  if (!goal) {
    return <span>{t('goal.noUsage')}</span>
  }
  const displayTimeUsedSeconds = timeUsedSeconds ?? goal.timeUsedSeconds
  const tokenText =
    goal.tokenBudget !== undefined && goal.tokenBudget !== null
      ? t('goal.tokensWithBudget', {
          used: formatGoalTokens(goal.tokensUsed),
          budget: formatGoalTokens(goal.tokenBudget)
        })
      : t('goal.tokensOnly', { tokens: formatGoalTokens(goal.tokensUsed) })
  return (
    <>
      {displayTimeUsedSeconds > 0 ? (
        <span>{formatGoalElapsedSeconds(displayTimeUsedSeconds)}</span>
      ) : null}
      <span>{tokenText}</span>
    </>
  )
}

export function useLiveGoalElapsedSeconds(
  goal?: SessionGoal,
  activeRunStartedAt?: number | null,
  runState?: string | undefined
): number {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    if (!activeRunStartedAt) return
    const tick = (): void => setNow(Date.now())
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [activeRunStartedAt])

  if (!goal) return 0
  const activeRunSeconds =
    runState === 'running' && activeRunStartedAt
      ? Math.max(0, Math.floor((now - activeRunStartedAt) / 1000))
      : 0
  return goal.timeUsedSeconds + activeRunSeconds
}

