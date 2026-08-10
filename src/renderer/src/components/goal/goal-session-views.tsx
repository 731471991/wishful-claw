import * as React from 'react'
import type { TFunction } from 'i18next'
import { toast } from 'sonner'
import { formatGoalElapsedSeconds, formatGoalTokens, validateGoalObjective } from '../../lib/agent/goal-context'
import { AlertTriangle } from 'lucide-react'
import {
  useGoalStore,
  type SessionGoal,
  type SessionGoalEvent,
  type SessionGoalEventType
} from '@renderer/stores/goal-store'
import { abortSession } from '@renderer/hooks/use-chat-actions'
import { useTranslation } from 'react-i18next'
import {
  eventMetadataNumber,
  eventMetadataString
} from './goal-session-utils'
import { invokeMessagePackBinary } from '@renderer/lib/ipc/messagepack-ipc-client'
import {
  GOAL_PAUSE_MSGPACK_CHANNEL,
  GOAL_RESUME_MSGPACK_CHANNEL,
  GOAL_ABORT_MSGPACK_CHANNEL
} from '@shared/messagepack/binary-ipc'

const BLOCKER_EVENT_TYPES = new Set<SessionGoalEventType>([
  'usage_limited',
  'budget_limited',
  'completion_deferred',
  'blocked',
  'stall_paused',
  'auto_continue_blocked'
])

export function formatGoalEvent(
  event: SessionGoalEvent,
  t: TFunction
): {
  title: string
  detail: string | null
} {
  const tokenDelta = eventMetadataNumber(event, 'tokenDelta')
  const timeDelta = eventMetadataNumber(event, 'timeDeltaSeconds')
  const from = eventMetadataString(event, 'from')
  const to = eventMetadataString(event, 'to')

  switch (event.eventType) {
    case 'usage_accounted':
      return {
        title: t('goal.events.usage_accounted'),
        detail:
          tokenDelta !== null || timeDelta !== null
            ? t('goal.events.usageDetail', {
                tokens: formatGoalTokens(tokenDelta ?? 0),
                time: formatGoalElapsedSeconds(timeDelta ?? 0)
              })
            : null
      }
    case 'status_changed':
      return {
        title: t('goal.events.status_changed'),
        detail:
          from && to
            ? t('goal.events.statusDetail', {
                from: t(`goal.status.${from}`, { defaultValue: from }),
                to: t(`goal.status.${to}`, { defaultValue: to })
              })
            : null
      }
    default:
      return {
        title: t(`goal.events.${event.eventType}`, { defaultValue: event.eventType }),
        detail: event.message ?? null
      }
  }
}

export function GoalEventTimeline({ events }: { events: SessionGoalEvent[] }): React.JSX.Element {
  const { t } = useTranslation('chat')
  const visibleEvents = events.slice(0, 8)
  if (visibleEvents.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('goal.timelineEmpty')}</p>
  }
  return (
    <div className="space-y-2">
      {visibleEvents.map((event) => {
        const formatted = formatGoalEvent(event, t)
        return (
          <div key={event.id} className="flex gap-2 text-xs">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary/70" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{formatted.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {new Date(event.createdAt).toLocaleTimeString()}
                </span>
              </div>
              {formatted.detail ? (
                <p className="mt-0.5 line-clamp-2 break-words text-[11px] text-muted-foreground">
                  {formatted.detail}
                </p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LatestGoalNotice({ events }: { events: SessionGoalEvent[] }): React.JSX.Element | null {
  const { t } = useTranslation('chat')
  const latest = events.find((event) => BLOCKER_EVENT_TYPES.has(event.eventType))
  if (!latest) return null
  const formatted = formatGoalEvent(latest, t)
  return (
    <div className="flex items-start gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
      <span className="line-clamp-2 break-words">{formatted.detail ?? formatted.title}</span>
    </div>
  )
}

export function useGoalActions(
  sessionId?: string | null,
  goal?: SessionGoal
): {
  open: boolean
  objectiveDraft: string
  tokenBudgetDraft: string
  saving: boolean
  clearing: boolean
  confirming: boolean
  setOpen: (open: boolean) => void
  setObjectiveDraft: (value: string) => void
  setTokenBudgetDraft: (value: string) => void
  openManager: () => void
  saveGoal: () => Promise<void>
  clearGoal: () => Promise<void>
  setGoalStatus: (status: 'active' | 'paused') => Promise<void>
  abortGoal: () => Promise<void>
  confirmGoal: () => Promise<void>
} {
  const { t } = useTranslation('chat')
  const { t: tCommon } = useTranslation('common')
  const [open, setOpen] = React.useState(false)
  const [objectiveDraft, setObjectiveDraft] = React.useState('')
  const [tokenBudgetDraft, setTokenBudgetDraft] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [clearing, setClearing] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)

  const openManager = React.useCallback(() => {
    setObjectiveDraft(goal?.objective ?? '')
    setTokenBudgetDraft(
      goal?.tokenBudget !== undefined && goal.tokenBudget !== null ? String(goal.tokenBudget) : ''
    )
    setOpen(true)
  }, [goal])

  const parseGoalTokenBudget = React.useCallback((): {
    tokenBudget: number | null
    error?: string
  } => {
    const raw = tokenBudgetDraft.trim()
    if (!raw) return { tokenBudget: null }
    if (!/^\d+$/.test(raw)) {
      return { tokenBudget: null, error: t('goal.errors.invalidBudget') }
    }
    const tokenBudget = Number(raw)
    if (!Number.isSafeInteger(tokenBudget) || tokenBudget <= 0) {
      return { tokenBudget: null, error: t('goal.errors.invalidBudget') }
    }
    return { tokenBudget }
  }, [tokenBudgetDraft, t])

  const setGoalStatus = React.useCallback(
    async (status: 'active' | 'paused'): Promise<void> => {
      if (!sessionId) return
      // 执行状态（RunState）由后端 Orchestrator 管理，不修改 DB 目标状态（Status）。
      // Resume/Pause 只发送 IPC 让后端切换 RunState。
      if (status === 'active') {
        try { await invokeMessagePackBinary(GOAL_RESUME_MSGPACK_CHANNEL, { sessionId, goalId: goal?.goalId }) } catch { /* orchestrator may not be running */ }
      }
      if (status === 'paused') {
        abortSession(sessionId)
        try { await invokeMessagePackBinary(GOAL_PAUSE_MSGPACK_CHANNEL, { sessionId, goalId: goal?.goalId }) } catch { /* orchestrator may not be running */ }
      }
    },
    [sessionId, goal?.goalId]
  )

  const abortGoal = React.useCallback(
    async (): Promise<void> => {
      if (!sessionId || !goal) return
      try {
        await invokeMessagePackBinary(GOAL_ABORT_MSGPACK_CHANNEL, { sessionId, goalId: goal.goalId })
      } catch { /* ignore */ }
      await useGoalStore.getState().updateGoal(sessionId, { status: 'paused' })
    },
    [sessionId, goal]
  )

  const clearGoal = React.useCallback(async (): Promise<void> => {
    if (!sessionId || !goal) return
    const confirmed = await (confirm as any)({
      title: t('goal.clearConfirmTitle'),
      description: t('goal.clearConfirmDesc'),
      confirmLabel: tCommon('action.clear'),
      variant: 'destructive'
    })
    if (!confirmed) return
    setClearing(true)
    const result = await useGoalStore.getState().clearGoal(sessionId)
    setClearing(false)
    if (!result.success) {
      toast.error(t('goal.toasts.clearFailed'), { description: result.error })
      return
    }
    setOpen(false)
    setObjectiveDraft('')
    setTokenBudgetDraft('')
  }, [goal, sessionId, t, tCommon])

  const saveGoal = React.useCallback(async (): Promise<void> => {
    if (!sessionId) return
    const objective = objectiveDraft.trim()
    const validation = validateGoalObjective(objective)
    if (validation) {
      toast.error(t('goal.toasts.objectiveInvalid'), { description: validation })
      return
    }
    const budget = parseGoalTokenBudget()
    if (budget.error) {
      toast.error(t('goal.toasts.budgetInvalid'), { description: budget.error })
      return
    }

    setSaving(true)
    const result = goal
      ? await useGoalStore.getState().updateGoal(sessionId, {
          objective,
          tokenBudget: budget.tokenBudget
        })
      : await useGoalStore.getState().setGoal({
          sessionId,
          objective,
          tokenBudget: budget.tokenBudget
        })
    setSaving(false)
    if (!result.success) {
      toast.error(goal ? t('goal.toasts.updateFailed') : t('goal.toasts.createFailed'), {
        description: result.error
      })
      return
    }
    setOpen(false)
  }, [goal, objectiveDraft, parseGoalTokenBudget, sessionId, t])

  const confirmGoal = React.useCallback(async (): Promise<void> => {
    if (!sessionId || !goal) return
    setConfirming(true)
    const result = await useGoalStore.getState().confirmGoal(sessionId, goal.goalId)
    setConfirming(false)
    if (!result.success) {
      toast.error(t('goal.toasts.confirmFailed'), { description: result.error })
    }
  }, [sessionId, goal, t])

  return {
    open,
    objectiveDraft,
    tokenBudgetDraft,
    saving,
    clearing,
    confirming,
    setOpen,
    setObjectiveDraft,
    setTokenBudgetDraft,
    openManager,
    saveGoal,
    clearGoal,
    setGoalStatus,
    abortGoal,
    confirmGoal
  }
}

