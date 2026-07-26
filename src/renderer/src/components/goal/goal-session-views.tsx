import * as React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Pause,
  Pencil,
  Play,
  Plus,
  Save,
  Target,
  Trash2,
  Zap
} from 'lucide-react'
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
import { confirm } from '@renderer/components/ui/confirm-dialog'
import { CollapsibleHeightPanel } from '@renderer/components/chat/CollapsibleHeightPanel'
import { cn } from '@renderer/lib/utils'
import { useSettingsStore } from '@renderer/stores/settings-store'
import {
  formatGoalElapsedSeconds,
  formatGoalTokens,
  goalStatusLabel,
  validateGoalObjective
} from '@renderer/lib/agent/goal-context'
import {
  EMPTY_SESSION_GOAL_EVENTS,
  useGoalStore,
  type SessionGoal,
  type SessionGoalEvent,
  type SessionGoalEventType
} from '@renderer/stores/goal-store'
import { abortSession, dispatchNextQueuedMessageForSession } from '@renderer/hooks/use-chat-actions'

const BLOCKER_EVENT_TYPES = new Set<SessionGoalEventType>([
  'usage_limited',
  'budget_limited',
  'completion_deferred',
  'blocked',
  'stall_paused',
  'auto_continue_blocked'
])
function formatGoalEvent(
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

function GoalEventTimeline({ events }: { events: SessionGoalEvent[] }): React.JSX.Element {
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

function LatestGoalNotice({ events }: { events: SessionGoalEvent[] }): React.JSX.Element | null {
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

function useGoalActions(
  sessionId?: string | null,
  goal?: SessionGoal
): {
  open: boolean
  objectiveDraft: string
  tokenBudgetDraft: string
  saving: boolean
  clearing: boolean
  setOpen: (open: boolean) => void
  setObjectiveDraft: (value: string) => void
  setTokenBudgetDraft: (value: string) => void
  openManager: () => void
  saveGoal: () => Promise<void>
  clearGoal: () => Promise<void>
  setGoalStatus: (status: 'active' | 'paused') => Promise<void>
} {
  const { t } = useTranslation('chat')
  const { t: tCommon } = useTranslation('common')
  const [open, setOpen] = React.useState(false)
  const [objectiveDraft, setObjectiveDraft] = React.useState('')
  const [tokenBudgetDraft, setTokenBudgetDraft] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [clearing, setClearing] = React.useState(false)

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
