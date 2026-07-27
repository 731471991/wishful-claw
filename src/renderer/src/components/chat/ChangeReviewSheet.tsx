import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Copy, FileCode, Loader2, RotateCcw, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { confirm } from '@renderer/components/ui/confirm-dialog'
import { Sheet, SheetContent } from '@renderer/components/ui/sheet'
import { MONO_FONT } from '@renderer/lib/constants'
import { cn } from '@renderer/lib/utils'
import type { AgentRunChangeSet } from '@renderer/stores/agent-store'
import { useAgentStore } from '@renderer/stores/agent-store'
import { CodeDiffViewer } from './CodeDiffViewer'
import { ActionLabel, CopyIconButton, CodeFrame, EmptyState, ChangeDetail, ChangeRow } from './change-review-helpers'
import { useAggregatedChangeSummaries } from './change-summary-utils'
import { aggregateDisplayableRunFileChanges, matchesAggregatedChangeId } from './file-change-utils'

export function ChangeReviewPanelContent({
  runId,
  initialChangeId = null,
  changeSetOverride = null
}: ChangeReviewPanelContentProps): React.JSX.Element {
  const { t } = useTranslation(['chat', 'common'])
  const storedChangeSet = useAgentStore((state) => state.runChangesByRunId[runId] ?? null)
  const refreshRunChanges = useAgentStore((state) => state.refreshRunChanges)
  const undoRunChanges = useAgentStore((state) => state.undoRunChanges)
  const [selectedChangeId, setSelectedChangeId] = React.useState<string | null>(null)
  const [isUndoingAll, setIsUndoingAll] = React.useState(false)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const requestedRunIdRef = React.useRef<string | null>(null)
  const changeSet = changeSetOverride ?? storedChangeSet
  const aggregatedChanges = React.useMemo(
    () => aggregateDisplayableRunFileChanges(changeSet?.changes ?? []),
    [changeSet?.changes]
  )
  const summariesByChangeId = useAggregatedChangeSummaries(aggregatedChanges)

  React.useEffect(() => {
    if (changeSetOverride || changeSet || requestedRunIdRef.current === runId) return

    let cancelled = false
    requestedRunIdRef.current = runId
    setIsRefreshing(true)

    const sessionId =
      changeSet && typeof (changeSet as AgentRunChangeSet).sessionId === 'string'
        ? ((changeSet as AgentRunChangeSet).sessionId ?? undefined)
        : undefined

    void refreshRunChanges(runId, sessionId ? { sessionId } : undefined).finally(() => {
      if (!cancelled) {
        setIsRefreshing(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [changeSet, changeSetOverride, refreshRunChanges, runId])

  React.useEffect(() => {
    if (!changeSet) {
      setSelectedChangeId(null)
      return
    }

    setSelectedChangeId((current) => {
      const preferredId = current ?? initialChangeId
      if (!preferredId) return null
      const matched = aggregatedChanges.find((change) =>
        matchesAggregatedChangeId(change, preferredId)
      )
      return matched?.id ?? null
    })
  }, [aggregatedChanges, changeSet, initialChangeId])

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

  const pendingCount = React.useMemo(
    () => aggregatedChanges.filter((change) => change.status === 'open').length,
    [aggregatedChanges]
  )
  const actionable = pendingCount > 0

  const handleUndoAll = async (): Promise<void> => {
    const confirmed = await confirm({
      title: t('fileChange.undoRunConfirmTitle'),
      description: t('fileChange.undoRunConfirmDesc', { count: pendingCount }),
      confirmLabel: t('fileChange.undoConfirmAction'),
      variant: 'destructive'
    })
    if (!confirmed) return
    setIsUndoingAll(true)
    try {
      await undoRunChanges(runId)
    } finally {
      setIsUndoingAll(false)
    }
  }

  if (isRefreshing && !changeSet) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        <Loader2 className="mr-2 size-4 animate-spin text-emerald-400" />
        {t('thinking.thinkingEllipsis')}
      </div>
    )
  }

  if (!changeSet || aggregatedChanges.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-foreground dark:text-zinc-100">
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground dark:text-zinc-400">
                {t('fileChange.filesChanged', { count: aggregatedChanges.length })}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                +{summary.added}
              </span>
              <span className="text-xs font-semibold text-red-600 dark:text-red-300">
                -{summary.deleted}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {t('fileChange.reviewPanelDescription', {
                defaultValue:
                  'Review the changed files from this run, expand an item to inspect details, and undo any change.'
              })}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="text-foreground hover:bg-muted dark:text-zinc-200 dark:hover:bg-white/[0.04]"
              onClick={() => void handleUndoAll()}
              disabled={!actionable || isUndoingAll}
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

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-4 py-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t('fileChange.reviewFileList', { defaultValue: 'Files' })}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-1.5">
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
          </div>
        </div>
      </div>
    </div>
  )
}

export function ChangeReviewSheet({
  open,
  onOpenChange,
  changeSet,
  initialChangeId = null
}: ChangeReviewSheetProps): React.JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[min(820px,calc(100vw-24px))] max-w-none gap-0 border-l border-white/10 bg-[#0d0e10]/98 p-0 text-zinc-100 shadow-[-24px_0_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:max-w-[820px]"
      >
        <ChangeReviewPanelContent
          runId={changeSet.runId}
          initialChangeId={initialChangeId}
          changeSetOverride={changeSet}
        />
      </SheetContent>
    </Sheet>
  )
}
