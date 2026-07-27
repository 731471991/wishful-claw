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
import {

function isErrorResult(value: unknown): value is { error: string } {
  return !!value && typeof value === 'object' && 'error' in value && typeof value.error === 'string'
}

function actionLabelKey(change: AggregatedFileChange): 'fileChange.new' | 'fileChange.edited' {
  return change.op === 'create' ? 'fileChange.new' : 'fileChange.edited'
}

function statusLabelKey(
  change: AggregatedFileChange
): 'fileChange.status.reverted' | 'fileChange.status.pending' {
  if (change.status === 'reverted') return 'fileChange.status.reverted'
  return 'fileChange.status.pending'
}

function statusTone(change: AggregatedFileChange): string {
  if (change.status === 'reverted') {
    return 'text-muted-foreground dark:text-zinc-300'
  }
  return 'text-sky-600 dark:text-sky-300'
}

function actionTone(): string {
  return 'text-muted-foreground dark:text-zinc-400'
}

function transportTone(change: AggregatedFileChange): string {
  return change.transport === 'ssh'
    ? 'text-sky-600 dark:text-sky-300'
    : 'text-muted-foreground dark:text-zinc-400'
}

export function ActionLabel({ change }: { change: AggregatedFileChange }): React.JSX.Element {
  const { t } = useTranslation('chat')
  return (
    <span className={cn('inline-flex items-center text-[10px] font-medium', actionTone())}>
      {t(actionLabelKey(change))}
    </span>
  )
}

export function CopyIconButton({ text }: { text: string }): React.JSX.Element {
  const { t } = useTranslation(['common'])
  const [copied, setCopied] = React.useState(false)

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      }}
      title={t('action.copy', { ns: 'common' })}
      aria-label={t('action.copy', { ns: 'common' })}
    >
      {copied ? <Check className="size-3 text-emerald-300" /> : <Copy className="size-3" />}
    </Button>
  )
}

export function CodeFrame({
  content,
  maxHeight = 520
}: {
  content: string
  maxHeight?: number
}): React.JSX.Element {
  const lines = React.useMemo(() => content.split('\n'), [content])

  return (
    <div
      className="overflow-auto rounded-[18px] border border-white/8 bg-[#111214] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
      style={{ maxHeight, fontFamily: MONO_FONT }}
    >
      {lines.map((line, index) => (
        <div
          key={`${index}-${line.length}`}
          className="grid grid-cols-[56px_minmax(0,1fr)] border-b border-white/[0.04] text-[11px] leading-5 last:border-b-0"
        >
          <span className="select-none border-r border-white/[0.05] px-2 py-1 text-right text-zinc-600">
            {index + 1}
          </span>
          <span className="min-w-0 whitespace-pre-wrap break-all px-3 py-1 text-zinc-100">
            {line || ' '}
          </span>
        </div>
      ))}
    </div>
  )
}

export function EmptyState(): React.JSX.Element {
  const { t } = useTranslation('chat')
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <FileCode className="size-8 text-zinc-500" />
      <div>
        <p className="text-sm font-medium text-zinc-100">
          {t('fileChange.reviewEmpty', { defaultValue: 'No file changes to review' })}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {t('fileChange.reviewEmptyHint', {
            defaultValue: 'Changed files and diffs will appear here for this run.'
          })}
        </p>
      </div>
    </div>
  )
}

export function ChangeDetail({ change }: { change: AggregatedFileChange }): React.JSX.Element {
  const { t } = useTranslation('chat')
  const [loadedContent, setLoadedContent] = React.useState<LoadedChangeContent | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const shouldLoadFullContent =
    change.op === 'create'
      ? !canRenderInlineSnapshot(change.after)
      : !canRenderInlineSnapshot(change.before) || !canRenderInlineSnapshot(change.after)

  React.useEffect(() => {
    if (!shouldLoadFullContent) {
      setLoadedContent(null)
      setLoadError(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    const load = async (): Promise<void> => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const result = await loadAggregatedChangeContent(change)

        if (cancelled) return

        if (isLoadedChangeContent(result)) {
          setLoadedContent({
            beforeText: result.beforeText,
            afterText: result.afterText
          })
          return
        }

        if (isErrorResult(result)) {
          setLoadError(result.error)
          return
        }

        setLoadError(
          t('fileChange.loadDiffFailed', { defaultValue: 'Failed to load the full diff' })
        )
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [change, shouldLoadFullContent, t])

  const beforeText =
    loadedContent?.beforeText ?? (change.op === 'modify' ? snapshotText(change.before) : '')
  const afterText = loadedContent?.afterText ?? snapshotText(change.after)
  const diffLines = React.useMemo(
    () => (change.op === 'modify' ? computeDiff(beforeText, afterText) : []),
    [afterText, beforeText, change.op]
  )
  const diffChunks = React.useMemo(() => foldContext(diffLines), [diffLines])
  const diffCopyText = React.useMemo(() => buildDiffCopyText(diffLines), [diffLines])

  if (isLoading && !loadedContent && shouldLoadFullContent) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-[20px] border border-white/8 bg-[#111214] text-sm text-zinc-400">
        <Loader2 className="mr-2 size-4 animate-spin text-emerald-400" />
        {t('thinking.thinkingEllipsis')}
      </div>
    )
  }

  if (loadError && !loadedContent && shouldLoadFullContent) {
    return (
      <div className="rounded-[20px] border border-red-500/20 bg-red-500/10 px-4 py-4 text-sm text-red-200">
        {loadError}
      </div>
    )
  }

  if (change.op === 'create') {
    const copyText = afterText || change.after.previewText || ''
    const displayText = afterText || change.after.previewText || ''

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          <span className="text-[11px] text-emerald-300">{detectLang(change.filePath)}</span>
          <span>{t('fileChange.lineCount', { count: lineCount(displayText) })}</span>
          {copyText ? <CopyIconButton text={copyText} /> : null}
        </div>
        <CodeFrame content={displayText || change.after.previewText || ''} />
      </div>
    )
  }

  return (
    <CodeDiffViewer
      chunks={diffChunks}
      defaultMode="inline"
      toolbarEnd={diffCopyText ? <CopyIconButton text={diffCopyText} /> : null}
    />
  )
}

export function ChangeRow({
  change,
  summary,
  expanded,
  onToggle
}: {
  change: AggregatedFileChange
  summary: DiffSummaryStats
  expanded: boolean
  onToggle: () => void
}): React.JSX.Element {
  const { t } = useTranslation(['chat', 'common'])
  const undoFileChange = useAgentStore((state) => state.undoFileChange)
  const [isUndoing, setIsUndoing] = React.useState(false)
  const actionableChanges = React.useMemo(() => actionableSourceChanges(change), [change])
  const actionable = actionableChanges.length > 0

  const handleUndo = async (): Promise<void> => {
    if (!actionable) return
    const confirmed = await confirm({
      title: t('fileChange.undoFileConfirmTitle'),
      description: t('fileChange.undoFileConfirmDesc', { path: change.filePath }),
      confirmLabel: t('fileChange.undoConfirmAction'),
      variant: 'destructive'
    })
    if (!confirmed) return
    setIsUndoing(true)
    try {
      for (const entry of [...actionableChanges].reverse()) {
        await undoFileChange(entry.runId, entry.id)
      }
    } finally {
      setIsUndoing(false)
    }
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border transition-colors',
        expanded
          ? 'border-border bg-muted/40 dark:border-white/[0.12] dark:bg-white/[0.03]'
          : 'border-border bg-card hover:border-muted-foreground/30 dark:border-white/[0.06] dark:bg-[#0f1012] dark:hover:border-white/[0.1]'
      )}
    >
      <div className="flex items-start gap-1.5 px-2.5 py-2">
        <button
          type="button"
          className="min-w-0 flex flex-1 items-start gap-2.5 text-left"
          onClick={onToggle}
          title={change.filePath}
          aria-expanded={expanded}
        >
          <ChevronDown
            className={cn(
              'mt-0.5 size-3.5 shrink-0 transition-transform duration-200',
              expanded ? 'rotate-180 text-foreground dark:text-zinc-300' : 'text-muted-foreground'
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <ActionLabel change={change} />
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-sky-600 dark:text-sky-300">
                {fileName(change.filePath)}
              </span>
              <span className="shrink-0 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
                +{summary.added}
              </span>
              <span className="shrink-0 text-[10px] font-medium text-red-600 dark:text-red-300">
                -{summary.deleted}
              </span>
            </div>
            <div
              className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-muted-foreground"
              style={{ fontFamily: MONO_FONT }}
            >
              {change.filePath}
            </div>
          </div>
        </button>

        {actionable ? (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-500 dark:hover:bg-white/[0.03] dark:hover:text-white"
            onClick={() => void handleUndo()}
            disabled={isUndoing}
            title={t('action.undo', { ns: 'common' })}
            aria-label={t('action.undo', { ns: 'common' })}
          >
            {isUndoing ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
          </Button>
        ) : (
          <RotateCcw className="mt-1 size-4 shrink-0 text-muted-foreground" />
        )}
      </div>

      {expanded ? (
        <div className="border-t border-border px-3 pb-3 pt-2.5 dark:border-white/[0.06]">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
            <span className={cn(statusTone(change))}>{t(statusLabelKey(change))}</span>
            <span className={cn(transportTone(change))}>
              {t(`fileChange.transport.${change.transport}`)}
            </span>
          </div>
          <div
            className="mb-2 break-all text-[10px] text-muted-foreground"
            style={{ fontFamily: MONO_FONT }}
          >
            {change.filePath}
          </div>
          <ChangeDetail change={change} />
        </div>
      ) : null}
    </div>
  )
}

interface ChangeReviewPanelContentProps {
  runId: string
  initialChangeId?: string | null
  changeSetOverride?: AgentRunChangeSet | null
}

