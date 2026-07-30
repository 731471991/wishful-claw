import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence } from 'motion/react'
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useChatStore } from '@renderer/stores/chat-store'
import { useUIStore } from '@renderer/stores/ui-store'
import type { UnifiedMessage } from '@renderer/lib/api/types'
import { useAggregatedChangeSummaries } from '@renderer/components/chat/change-summary-utils'
import { aggregateDisplayableRunFileChanges, latestDisplayableRunChangeSet, matchesAggregatedChangeId } from '@renderer/components/chat/file-change-utils'
import { ChangeRow } from './change-review-row'
import { ReviewEmptyState } from './change-detail'

interface SessionChangeReviewPanelProps {
  sessionId?: string | null
  initialChangeId?: string | null
  onClose?: () => void
  selectionRequestId?: string | null
}

const EMPTY_SESSION_MESSAGES: UnifiedMessage[] = []

export function SessionChangeReviewPanel({
  initialChangeId = null,
  selectionRequestId
}: SessionChangeReviewPanelProps): React.JSX.Element {
  const { t } = useTranslation(['layout', 'chat', 'common'])
  const activeScopedSessionId = useUIStore((state) => state.activeScopedSessionId)
  const chatActiveSessionId = useChatStore((state) => state.activeSessionId)
  const activeSessionId = activeScopedSessionId ?? chatActiveSessionId
  const sessionMessages = useChatStore((state) => {
    if (!activeSessionId) return EMPTY_SESSION_MESSAGES
    return (
      state.sessions.find((session) => session.id === activeSessionId)?.messages ??
      EMPTY_SESSION_MESSAGES
    )
  })
  const runChangesByRunId = useAgentStore((state) => state.runChangesByRunId)
  const refreshSessionRunChanges = useAgentStore((state) => state.refreshSessionRunChanges)
  const undoRunChanges = useAgentStore((state) => state.undoRunChanges)
  const [selectedChangeId, setSelectedChangeId] = React.useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [isUndoingAll, setIsUndoingAll] = React.useState(false)
  const requestedRefreshKeyRef = React.useRef<string | null>(null)
  const lastInitialChangeIdRef = React.useRef<string | null>(null)
  const lastSelectionRequestIdRef = React.useRef<number | undefined>(undefined)

  const assistantMessageIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const message of sessionMessages) {
      if (message.role === 'assistant') ids.add(message.id)
    }
    return ids
  }, [sessionMessages])

  React.useEffect(() => {
    if (!activeSessionId) return
    if (requestedRefreshKeyRef.current === activeSessionId) return
    requestedRefreshKeyRef.current = activeSessionId
    setIsRefreshing(true)
    void refreshSessionRunChanges(activeSessionId).finally(() => setIsRefreshing(false))
  }, [activeSessionId, refreshSessionRunChanges])

  const sessionChangeSets = React.useMemo(() => {
    const seen = new Set<string>()
    return Object.values(runChangesByRunId)
      .filter((changeSet) => {
        if (!activeSessionId) return false
        if (changeSet.sessionId === activeSessionId) return true
        if (changeSet.changes.some((change) => change.sessionId === activeSessionId)) return true
        return (
          assistantMessageIds.has(changeSet.assistantMessageId) ||
          assistantMessageIds.has(changeSet.runId)
        )
      })
      .filter((changeSet) => {
        if (seen.has(changeSet.runId)) return false
        seen.add(changeSet.runId)
        return true
      })
      .sort((left, right) => left.createdAt - right.createdAt)
  }, [activeSessionId, assistantMessageIds, runChangesByRunId])

  const latestChangeSet = React.useMemo(
    () => latestDisplayableRunChangeSet(sessionChangeSets),
    [sessionChangeSets]
  )
  const aggregatedChanges = React.useMemo(
    () =>
      aggregateDisplayableRunFileChanges(latestChangeSet?.changes ?? []).sort(
        (left, right) => left.createdAt - right.createdAt
      ),
    [latestChangeSet]
  )
  const summariesByChangeId = useAggregatedChangeSummaries(aggregatedChanges)

  React.useEffect(() => {
    const nextInitialChangeId = initialChangeId ?? null
    const selectionRequested =
      (selectionRequestId as any) !== undefined && lastSelectionRequestIdRef.current !== (selectionRequestId as any)
    setSelectedChangeId((current) => {
      const preferredId =
        nextInitialChangeId &&
        (selectionRequested || lastInitialChangeIdRef.current !== nextInitialChangeId || !current)
          ? nextInitialChangeId
          : current
      if (!preferredId) return null
      const matched = aggregatedChanges.find((change) =>
        matchesAggregatedChangeId(change, preferredId)
      )
      return matched?.id ?? null
    })
    lastInitialChangeIdRef.current = nextInitialChangeId
    lastSelectionRequestIdRef.current = selectionRequestId as any
  }, [aggregatedChanges, initialChangeId, selectionRequestId])

  const summary = React.useMemo(
    () =>
      aggregatedChanges.reduce(
        (acc, change) => {
          const next = summariesByChangeId[change.id]
          if (!next) return acc
          acc.added += next.added
          acc.deleted += next.deleted
          return acc
        },
        { added: 0, deleted: 0 }
      ),
    [aggregatedChanges, summariesByChangeId]
  )

  const undoableRunIds = React.useMemo(
    () =>
      Array.from(
        new Set(
          sessionChangeSets
            .filter(
              (changeSet) =>
                changeSet.runId === latestChangeSet?.runId &&
                changeSet.changes.some((change) => change.status === 'open')
            )
            .map((changeSet) => changeSet.runId)
        )
      ),
    [latestChangeSet, sessionChangeSets]
  )
  const actionable = undoableRunIds.length > 0

  const handleRefresh = async (): Promise<void> => {
    if (!activeSessionId) return
    setIsRefreshing(true)
    try {
      await refreshSessionRunChanges(activeSessionId)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleUndoAll = async (): Promise<void> => {
    if (undoableRunIds.length === 0) return
    setIsUndoingAll(true)
    try {
      for (const runId of undoableRunIds) {
        await undoRunChanges(runId)
      }
    } finally {
      setIsUndoingAll(false)
    }
  }

  if (isRefreshing && aggregatedChanges.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin text-emerald-400" />
        {t('thinking.thinkingEllipsis', { ns: 'chat' })}
      </div>
    )
  }

  if (aggregatedChanges.length === 0) {
    return <ReviewEmptyState />
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/50 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {t('fileChange.filesChanged', {
                  ns: 'chat',
                  count: aggregatedChanges.length
                })}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                +{summary.added}
              </span>
              <span className="text-xs font-semibold text-red-600 dark:text-red-300">
                -{summary.deleted}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t('rightPanel.reviewSessionDesc', {
                defaultValue:
                  'Review the latest file changes captured in the current session. Expand a file to inspect the diff.'
              })}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing || isUndoingAll}
              title={t('action.refresh', { ns: 'common', defaultValue: 'Refresh' })}
            >
              <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => void handleUndoAll()}
              disabled={!actionable || isRefreshing || isUndoingAll}
            >
              {isUndoingAll ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RotateCcw className="size-3" />
              )}
              {t('action.undo', { ns: 'common' })}
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {aggregatedChanges.map((change) => (
            <ChangeRow
              key={change.id}
              change={change}
              summary={summariesByChangeId[change.id] ?? { added: 0, deleted: 0 }}
              expanded={change.id === selectedChangeId}
              onToggle={() =>
                setSelectedChangeId((current) => (current === change.id ? null : change.id))
              }
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}