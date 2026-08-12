import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Pause, Pencil, Play, Save, Target, XCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import { CollapsibleHeightPanel } from '@renderer/components/chat/CollapsibleHeightPanel'
import { cn } from '@renderer/lib/utils'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { formatGoalElapsedSeconds, formatGoalTokens } from '@renderer/lib/agent/goal-context'
import { useGoalStore, type GoalRunState, type SessionGoal, type SessionGoalEvent, type SessionGoalEventType } from '@renderer/stores/goal-store'

const BLOCKER_EVENT_TYPES = new Set<SessionGoalEventType>([
  'usage_limited',
  'budget_limited',
  'completion_deferred',
  'blocked',
  'stall_paused',
  'auto_continue_blocked'
])

import {
  useGoalSession,
  useLiveGoalElapsedSeconds,
  GoalStatusBadge,
  getGoalRuntimeControls
} from './goal-session-utils'
import { GoalEventTimeline, LatestGoalNotice, useGoalActions } from './goal-session-views'

function GoalManagerDialog({
  goal,
  events,
  runState,
  actions
}: {
  goal?: SessionGoal
  events: SessionGoalEvent[]
  runState: GoalRunState
  actions: ReturnType<typeof useGoalActions>
}): React.JSX.Element {
  const { t } = useTranslation('chat')
  const { t: tCommon } = useTranslation('common')
  const budgetPct =
    goal?.tokenBudget !== undefined && goal.tokenBudget !== null
      ? Math.min(100, (goal.tokensUsed / goal.tokenBudget) * 100)
      : null
  const controls = getGoalRuntimeControls(goal, runState)

  return (
    <Dialog open={actions.open} onOpenChange={actions.setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="size-4" />
            {goal ? t('goal.editTitle', { defaultValue: 'Edit goal' }) : t('goal.managerTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-md border border-border/70 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('goal.statusLabel')}
              </div>
              <div className="mt-1 text-sm font-medium">
                <GoalStatusBadge status={goal?.status} />
              </div>
            </div>
            <div className="rounded-md border border-border/70 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('goal.tokensLabel')}
              </div>
              <div className="mt-1 text-sm font-medium">
                {formatGoalTokens(goal?.tokensUsed ?? 0)}
              </div>
            </div>
            <div className="rounded-md border border-border/70 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('goal.budgetLabel')}
              </div>
              <div className="mt-1 text-sm font-medium">
                {goal?.tokenBudget !== undefined && goal.tokenBudget !== null
                  ? formatGoalTokens(goal.tokenBudget)
                  : t('goal.none')}
              </div>
            </div>
            <div className="rounded-md border border-border/70 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('goal.timeLabel')}
              </div>
              <div className="mt-1 text-sm font-medium">
                {formatGoalElapsedSeconds(goal?.timeUsedSeconds ?? 0)}
              </div>
            </div>
          </div>

          {budgetPct !== null ? (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{t('goal.budgetProgress')}</span>
                <span>{budgetPct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    budgetPct >= 100 ? 'bg-red-500' : 'bg-emerald-500'
                  )}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
            </div>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t('goal.objectiveLabel')}
            </span>
            <Textarea
              className="min-h-32 resize-y text-sm"
              value={actions.objectiveDraft}
              onChange={(event) => actions.setObjectiveDraft(event.target.value)}
              placeholder={t('goal.objectivePlaceholder')}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t('goal.tokenBudgetLabel')}
            </span>
            <Input
              inputMode="numeric"
              value={actions.tokenBudgetDraft}
              onChange={(event) => actions.setTokenBudgetDraft(event.target.value)}
              placeholder={t('goal.optional')}
            />
          </label>

          <div className="space-y-2 rounded-md border border-border/70 p-3">
            <div className="text-xs font-medium text-muted-foreground">{t('goal.timeline')}</div>
            <GoalEventTimeline events={events} />
          </div>
        </div>
        <DialogFooter className="items-center justify-between gap-2 sm:justify-between">
          <div className="flex items-center gap-1">
            {goal && controls.canPause ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => void actions.setGoalStatus('paused')}
              >
                <Pause className="size-3.5" />
                {t('goal.pause')}
              </Button>
            ) : null}
            {goal && controls.canResume ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => void actions.setGoalStatus('active')}
              >
                <Play className="size-3.5" />
                {controls.runState === 'idle' ? t('goal.start') : t('goal.resume')}
              </Button>
            ) : null}
            {goal && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-destructive"
                disabled={actions.cancelling}
                onClick={() => void actions.cancelGoal()}
              >
                <XCircle className="size-3.5" />
                {t('goal.cancel')}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => actions.setOpen(false)}
            >
              {tCommon('action.cancel')}
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              disabled={actions.saving}
              onClick={() => void actions.saveGoal()}
            >
              <Save className="size-3.5" />
              {t('goal.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GoalSessionBar({
  sessionId,
  className
}: {
  sessionId?: string | null
  className?: string
}): React.JSX.Element | null {
  const { t } = useTranslation('chat')
  const { goal, events, runState } = useGoalSession(sessionId)
  const actions = useGoalActions(sessionId, goal)
  const [expanded, setExpanded] = React.useState(true)
  const animationsEnabled = useSettingsStore((s) => s.animationsEnabled)
  const activeRunStartedAt = useGoalStore((s) => {
    if (!sessionId || !goal) return null
    const activeRun = s.activeGoalRunsBySession[sessionId]
    return activeRun && activeRun.goalId === goal.goalId ? activeRun.startedAt : null
  })
  const liveTimeUsedSeconds = useLiveGoalElapsedSeconds(goal, activeRunStartedAt, runState)
  const controls = getGoalRuntimeControls(goal, runState)

  React.useEffect(() => {
    setExpanded(true)
  }, [sessionId])

  if (!sessionId || goal?.status !== 'active') return null

  const statusTitle =
    runState === 'running'
      ? t('goal.runningTitle', { defaultValue: 'Pursuing goal' })
      : runState === 'paused'
        ? t('goal.pausedTitle', { defaultValue: 'Paused goal' })
        : t('goal.idleTitle', { defaultValue: 'Goal ready' })
  const hasBlockerNotice = events.some((event) => BLOCKER_EVENT_TYPES.has(event.eventType))

  return (
    <>
      <div className={cn('mx-auto w-full max-w-[820px]', className)}>
        <div
          className="rounded-2xl border border-border/70 bg-muted/40 px-3 py-2 shadow-sm backdrop-blur cursor-pointer hover:bg-muted/60 transition-colors"
          onClick={() => useUIStore.getState().openGoalPanel(sessionId, goal.projectId, goal.goalId)}
        >
          <div className="flex items-start gap-2">
            <Target className="mt-0.5 size-3.5 shrink-0 text-primary/80" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs font-semibold text-foreground/90">
                  {statusTitle}
                </span>
                {!expanded && (
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {goal.objective}
                  </span>
                )}
                {liveTimeUsedSeconds > 0 ? (
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatGoalElapsedSeconds(liveTimeUsedSeconds)}
                </span>
              ) : null}
              </div>
              {animationsEnabled ? (
                <CollapsibleHeightPanel
                  open={expanded}
                  className="overflow-hidden"
                  contentClassName="pt-1"
                >
                  <p className="line-clamp-4 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                    {goal.objective}
                  </p>
                </CollapsibleHeightPanel>
              ) : (
                expanded && (
                  <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                    {goal.objective}
                  </p>
                )
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md"
                title={t('goal.manage')}
                aria-label={t('goal.manage')}
                onClick={actions.openManager}
              >
                <Pencil className="size-3.5" />
              </Button>
              {controls.canPause ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md"
                  title={t('goal.pause')}
                  aria-label={t('goal.pause')}
                  onClick={() => void actions.setGoalStatus('paused')}
                >
                  <Pause className="size-3.5" />
                </Button>
              ) : controls.canResume ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-md"
                  title={t('goal.resume')}
                  aria-label={t('goal.resume')}
                  onClick={() => void actions.setGoalStatus('active')}
                >
                  <Play className="size-3.5" />
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-destructive/80"
                title={t('goal.cancel')}
                aria-label={t('goal.cancel')}
                onClick={() => void actions.cancelGoal()}
              >
                <XCircle className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 rounded-md"
                title={expanded ? t('goal.hide') : t('goal.show')}
                aria-label={expanded ? t('goal.hide') : t('goal.show')}
                aria-expanded={expanded}
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
          {expanded && hasBlockerNotice ? (
            <div className="mt-2">
              <LatestGoalNotice events={events} />
            </div>
          ) : null}
        </div>
      </div>
      <GoalManagerDialog goal={goal} events={events} runState={runState} actions={actions} />
    </>
  )
}
