import * as React from 'react'
import { ArrowLeft, Loader2, Pause, Play, RefreshCw, Target, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { useChatStore } from '@renderer/stores/chat-store'
import {
  goalHistoryKey,
  goalProjectKey,
  useGoalHistoryStore
} from '@renderer/stores/goal-history-store'
import { formatGoalElapsedSeconds, formatGoalTokens } from '@renderer/lib/agent/goal-context'
import { GoalEventTimeline, useGoalActions } from './goal-session-views'
import { getGoalRuntimeControls, GoalStatusBadge } from './goal-session-utils'
import { cancelGoalConfirm } from '@renderer/lib/tools/goal-native-ui'
import {
  useGoalStore,
  type SessionGoal,
  type SessionGoalStatus
} from '@renderer/stores/goal-store'
import { type SessionGoalEvent } from '@renderer/stores/goal-store-helpers'

const EMPTY_GOALS: SessionGoal[] = []
const EMPTY_EVENTS: SessionGoalEvent[] = []

interface GoalHistoryPanelProps {
  projectId?: string | null
  initialSessionId?: string | null
  initialGoalId?: string | null
}

type GoalHistoryFilter = 'all' | 'current' | 'complete' | 'failed' | 'aborted'

interface GoalPlanSummary {
  planId?: string
  title?: string
  status?: string
  resultSummary?: string | null
}

function matchesFilter(status: SessionGoalStatus, filter: GoalHistoryFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'current') return status === 'pending' || status === 'active'
  return status === filter
}

function parsePlans(goal: SessionGoal): GoalPlanSummary[] {
  if (!goal.plansJson) return []
  try {
    const value = JSON.parse(goal.plansJson)
    return Array.isArray(value) ? value as GoalPlanSummary[] : []
  } catch {
    return []
  }
}

export function GoalHistoryPanel({
  projectId = null,
  initialSessionId,
  initialGoalId
}: GoalHistoryPanelProps): React.JSX.Element {
  const { t } = useTranslation('chat')
  const { t: tCommon } = useTranslation('common')
  const projectKey = goalProjectKey(projectId)
  const goals = useGoalHistoryStore((state) => state.goalsByProject[projectKey] ?? EMPTY_GOALS)
  const loading = useGoalHistoryStore((state) => state.loadingProjects[projectKey] ?? false)
  const hasMoreGoals = useGoalHistoryStore((state) => state.goalHasMoreByProject[projectKey] ?? false)
  const error = useGoalHistoryStore((state) => state.errorsByProject[projectKey])
  const sessions = useChatStore((state) => state.sessions)
  const [selectedGoalId, setSelectedGoalId] = React.useState<string | null>(initialGoalId ?? null)
  const [filter, setFilter] = React.useState<GoalHistoryFilter>('all')

  React.useEffect(() => {
    void useGoalHistoryStore.getState().loadProjectGoals(projectId)
  }, [projectId])

  React.useEffect(() => {
    if (initialGoalId) {
      setSelectedGoalId(initialGoalId)
      return
    }
    if (!initialSessionId) return
    const match = goals.find((goal) => goal.sessionId === initialSessionId)
    if (match) setSelectedGoalId(match.goalId)
  }, [goals, initialGoalId, initialSessionId])

  const filteredGoals = React.useMemo(
    () => goals.filter((goal) => matchesFilter(goal.status, filter)),
    [filter, goals]
  )
  const selectedGoal = goals.find((goal) => goal.goalId === selectedGoalId) ?? null
  const selectedRunState = useGoalStore((state) =>
    selectedGoal ? state.goalRunStatesBySession[selectedGoal.sessionId] ?? 'idle' : 'idle'
  )
  const selectedActions = useGoalActions(selectedGoal?.sessionId, selectedGoal ?? undefined)
  const selectedControls = getGoalRuntimeControls(selectedGoal ?? undefined, selectedRunState)
  const selectedKey = selectedGoal
    ? goalHistoryKey(selectedGoal.sessionId, selectedGoal.goalId)
    : ''
  const events = useGoalHistoryStore((state) =>
    selectedKey ? state.eventsByGoal[selectedKey] ?? EMPTY_EVENTS : EMPTY_EVENTS
  )
  const eventsLoading = useGoalHistoryStore((state) =>
    selectedKey ? state.loadingGoals[selectedKey] ?? false : false
  )
  const hasMoreEvents = useGoalHistoryStore((state) =>
    selectedKey ? state.eventHasMoreByGoal[selectedKey] ?? false : false
  )

  React.useEffect(() => {
    if (!selectedGoal) return
    void useGoalHistoryStore
      .getState()
      .loadGoalEvents(selectedGoal.sessionId, selectedGoal.goalId)
  }, [selectedGoal?.goalId, selectedGoal?.sessionId])

  const cancelSelectedGoal = React.useCallback(async (): Promise<void> => {
    if (!selectedGoal) return
    if (selectedGoal.status === 'pending') {
      const confirmed = await (confirm as any)({
        title: t('goal.cancelConfirmTitle'),
        description: t('goal.cancelConfirmDesc'),
        confirmLabel: tCommon('action.cancel'),
        variant: 'destructive'
      })
      if (!confirmed) return
      const resolved = cancelGoalConfirm(selectedGoal.goalId, selectedGoal.sessionId)
      if (resolved) {
        useGoalHistoryStore.getState().applyGoalStatus(
          selectedGoal.projectId,
          selectedGoal.sessionId,
          selectedGoal.goalId,
          'aborted',
          Date.now()
        )
        return
      }
      await useGoalStore.getState().cancelGoal(selectedGoal.sessionId, selectedGoal.goalId)
      return
    }
    await selectedActions.cancelGoal()
  }, [selectedActions, selectedGoal, t, tCommon])

  if (selectedGoal) {
    const session = sessions.find((item) => item.id === selectedGoal.sessionId)
    const plans = parsePlans(selectedGoal)
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setSelectedGoalId(null)}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{session?.title ?? t('goal.history.deletedSession')}</div>
            <div className="truncate text-[10px] text-muted-foreground">{selectedGoal.sessionId}</div>
          </div>
          <GoalStatusBadge status={selectedGoal.status} />
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
          <section className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">{t('goal.objectiveLabel')}</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{selectedGoal.objective}</p>
          </section>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric label={t('goal.tokensLabel')} value={formatGoalTokens(selectedGoal.tokensUsed)} />
            <Metric label={t('goal.timeLabel')} value={formatGoalElapsedSeconds(selectedGoal.timeUsedSeconds)} />
            <Metric label={t('goal.history.plans')} value={`${selectedGoal.completedPlanCount} / ${selectedGoal.planCount}`} />
            <Metric label={t('goal.updatedAt')} value={new Date(selectedGoal.updatedAt).toLocaleString()} />
          </div>
          {selectedGoal.status === 'pending' || selectedGoal.status === 'active' ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 p-2">
              {selectedControls.canPause ? (
                <Button variant="outline" size="sm" className="h-7 gap-1.5" disabled={selectedActions.transitioning !== null} onClick={() => void selectedActions.setGoalStatus('paused')}>
                  <Pause className="size-3.5" />
                  {t('goal.pause')}
                </Button>
              ) : selectedControls.canResume ? (
                <Button variant="outline" size="sm" className="h-7 gap-1.5" disabled={selectedActions.transitioning !== null} onClick={() => void selectedActions.setGoalStatus('active')}>
                  {selectedActions.transitioning === 'starting' ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  {selectedRunState === 'idle' ? t('goal.start') : t('goal.resume')}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-destructive"
                disabled={selectedActions.cancelling}
                onClick={() => void cancelSelectedGoal()}
              >
                {selectedActions.cancelling ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                {t('goal.cancel')}
              </Button>
              {selectedGoal.status === 'pending' ? (
                <span className="text-[11px] text-muted-foreground">{t('goal.history.awaitingConfirmation')}</span>
              ) : null}
            </div>
          ) : null}
          {plans.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">{t('goal.history.plans')}</h3>
              <div className="space-y-1.5">
                {plans.map((plan, index) => (
                  <div key={plan.planId ?? index} className="rounded-md border border-border/60 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-medium">{plan.title ?? `Plan ${index + 1}`}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{plan.status ?? 'pending'}</span>
                    </div>
                    {plan.resultSummary ? <p className="mt-1 text-[11px] text-muted-foreground">{plan.resultSummary}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <section className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">{t('goal.timeline')}</h3>
            {eventsLoading && events.length === 0 ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <GoalEventTimeline events={events} maxItems={events.length} />
            )}
            {hasMoreEvents ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-full text-[11px]"
                disabled={eventsLoading}
                onClick={() => void useGoalHistoryStore.getState().loadMoreGoalEvents(selectedGoal.sessionId, selectedGoal.goalId)}
              >
                {eventsLoading ? t('goal.history.loadingMore') : t('goal.history.loadMore')}
              </Button>
            ) : null}
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div>
          <h3 className="text-sm font-semibold">{t('goal.history.title')}</h3>
          <p className="text-[11px] text-muted-foreground">{t('goal.history.subtitle')}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={loading}
          onClick={() => void useGoalHistoryStore.getState().loadProjectGoals(projectId, true)}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        </Button>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border/50 px-2 py-2">
        {(['all', 'current', 'complete', 'failed', 'aborted'] as GoalHistoryFilter[]).map((item) => (
          <Button
            key={item}
            variant={filter === item ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 shrink-0 px-2 text-[11px]"
            onClick={() => setFilter(item)}
          >
            {t(`goal.history.filters.${item}`)}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {error ? <p className="p-2 text-xs text-destructive">{error}</p> : null}
        {!loading && filteredGoals.length === 0 && !hasMoreGoals ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Target className="size-6 opacity-60" />
            <p className="text-xs">{t('goal.history.empty')}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredGoals.map((goal) => {
              const session = sessions.find((item) => item.id === goal.sessionId)
              return (
                <button
                  key={goal.goalId}
                  type="button"
                  className={cn('w-full rounded-lg border border-border/60 p-2.5 text-left transition-colors hover:bg-muted/50')}
                  onClick={() => setSelectedGoalId(goal.goalId)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <GoalStatusBadge status={goal.status} />
                    <span className="text-[10px] text-muted-foreground">{new Date(goal.updatedAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-foreground/90">{goal.objective}</p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">
                    {session?.title ?? t('goal.history.deletedSession')} · {goal.sessionId}
                  </p>
                  <div className="mt-1.5 flex gap-3 text-[10px] text-muted-foreground">
                    <span>{t('goal.history.planProgress', { completed: goal.completedPlanCount, total: goal.planCount })}</span>
                    <span>{formatGoalElapsedSeconds(goal.timeUsedSeconds)}</span>
                  </div>
                </button>
              )
            })}
            {hasMoreGoals ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-full text-[11px]"
                disabled={loading}
                onClick={() => void useGoalHistoryStore.getState().loadMoreProjectGoals(projectId)}
              >
                {loading ? t('goal.history.loadingMore') : t('goal.history.loadMore')}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-md border border-border/60 p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-medium">{value}</div>
    </div>
  )
}
