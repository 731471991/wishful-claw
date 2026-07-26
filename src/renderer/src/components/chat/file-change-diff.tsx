import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileCode,
  FilePlus2,
  FileX2,
  FileEdit,
  Loader2,
  CheckCircle2,
  XCircle,
  Check,
  Copy,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { decodeStructuredToolResult } from '@renderer/lib/tools/tool-result-format'
import type { AgentRunFileChange } from '@renderer/stores/agent-store'
import { useAgentStore } from '@renderer/stores/agent-store'
import { MONO_FONT } from '@renderer/lib/constants'
import { IPC } from '@renderer/lib/ipc/channels'
import { invokeMessagePackBinary } from '@renderer/lib/ipc/messagepack-ipc-client'
import { Button } from '@renderer/components/ui/button'
import { confirm } from '@renderer/components/ui/confirm-dialog'
import { toMessagePackChannel } from '../../../../shared/messagepack/binary-ipc'
import { LazySyntaxHighlighter } from './LazySyntaxHighlighter'
import {
  type FileChangeCardProps, type FilePreviewTone, type CompactActionOp,
  type DiffLine, type TrackedDiffContent,
  type ResolvedWritePayload,
  detectLang, shortPath, fileName, normalizeLineEndings, formatCompactCount,
  snapshotText, snapshotLineTotal, canRenderInlineSnapshot,
  computeDiff, summarizeDiff, foldContext,
  diffDisplayLineNumber, buildDiffCopyText, diffLineStyle,
  resolveEditPayload, resolveWritePayload, hasPendingEditPreviewContent,
  resolveEditSummaryDiff, trackedStatusLabelKey, trackedTransportLabelKey,
  trackedStatusTone, trackedStatusDotTone
} from './FileChangeCard/utils'

// ── Types ────────────────────────────────────────────────────────


function CompactDiffCopyButton({ text }: { text: string }): React.JSX.Element {
  const { t } = useTranslation(['chat', 'common'])
  const [copied, setCopied] = React.useState(false)

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      }}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      title={t('action.copy', { ns: 'common' })}
      aria-label={t('action.copy', { ns: 'common' })}
    >
      {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
    </button>
  )
}

function DiffCodeChunk({
  lines,
  filePath
}: {
  lines: DiffLine[]
  filePath: string
}): React.JSX.Element | null {
  if (lines.length === 0) return null

  const firstLineNumber = diffDisplayLineNumber(lines[0]) ?? 1

  return (
    <LazySyntaxHighlighter
      language={detectLang(filePath)}
      showLineNumbers
      wrapLines
      startingLineNumber={firstLineNumber}
      lineProps={(lineNumber: number) => {
        const index = Math.max(0, Math.min(lines.length - 1, lineNumber - firstLineNumber))
        return { style: diffLineStyle(lines[index]) }
      }}
      lineNumberStyle={{
        minWidth: '2.75em',
        paddingRight: '0.75em',
        color: 'var(--muted-foreground)',
        opacity: 0.72,
        userSelect: 'none'
      }}
      customStyle={{
        margin: 0,
        padding: '0.5rem 0',
        borderRadius: 0,
        fontSize: '11px',
        overflow: 'visible',
        fontFamily: MONO_FONT
      }}
      codeTagProps={{ style: { fontFamily: 'inherit' } }}
    >
      {lines.map((line) => line.text || ' ').join('\n')}
    </LazySyntaxHighlighter>
  )
}

function CompactEditDiff({
  oldStr,
  newStr,
  filePath
}: {
  oldStr: string
  newStr: string
  filePath: string
}): React.JSX.Element {
  const { t } = useTranslation('chat')
  const lines = React.useMemo(() => computeDiff(oldStr, newStr), [oldStr, newStr])
  const chunks = React.useMemo(() => foldContext(lines), [lines])
  const stats = React.useMemo(() => summarizeDiff(lines), [lines])
  const copyText = React.useMemo(() => buildDiffCopyText(lines), [lines])
  const [expandedChunks, setExpandedChunks] = React.useState<Set<number>>(new Set())

  React.useEffect(() => {
    setExpandedChunks(new Set())
  }, [filePath, oldStr, newStr])

  return (
    <FilePreviewShell
      filePath={filePath}
      added={stats.added}
      deleted={stats.deleted}
      copyText={copyText}
      tone="edit"
      maxHeight={320}
    >
      <div className="w-max min-w-full">
        {chunks.map((chunk, ci) => {
          if (chunk.type === 'lines' || expandedChunks.has(ci)) {
            return (
              <DiffCodeChunk key={`compact-code-${ci}`} lines={chunk.lines} filePath={filePath} />
            )
          }

          return (
            <button
              key={`compact-inline-collapsed-${ci}`}
              type="button"
              className="flex min-w-full items-center justify-center bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground dark:bg-[#15171a]/70 dark:text-zinc-500 dark:hover:bg-[#1a1d21] dark:hover:text-zinc-200"
              onClick={() => setExpandedChunks((prev) => new Set([...prev, ci]))}
            >
              {t('toolCall.unchangedLines', {
                count: chunk.count,
                defaultValue: '··· {{count}} unchanged lines ···'
              })}
            </button>
          )
        })}
      </div>
    </FilePreviewShell>
  )
}


function InlineDiff({
  oldStr,
  newStr,
  filePath
}: {
  oldStr: string
  newStr: string
  filePath: string
}): React.JSX.Element {
  return <CompactEditDiff oldStr={oldStr} newStr={newStr} filePath={filePath} />
}


function TrackedEditDiff({
  change,
  filePath
}: {
  change: AgentRunFileChange
  filePath: string
}): React.JSX.Element {
  const { t } = useTranslation('chat')
  const [content, setContent] = React.useState<TrackedDiffContent | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const canRenderInline =
    canRenderInlineSnapshot(change.before) && canRenderInlineSnapshot(change.after)

  React.useEffect(() => {
    if (canRenderInline) {
      setContent({
        beforeText: snapshotText(change.before),
        afterText: snapshotText(change.after)
      })
      setIsLoading(false)
      setLoadError(null)
      return
    }

    let cancelled = false
    const load = async (): Promise<void> => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const result = await invokeMessagePackBinary(
          toMessagePackChannel(IPC.AGENT_CHANGES_DIFF_CONTENT),
          {
            runId: change.runId,
            changeId: change.id
          }
        )
        if (cancelled) return
        if (
          result &&
          typeof result === 'object' &&
          'beforeText' in result &&
          'afterText' in result &&
          typeof result.beforeText === 'string' &&
          typeof result.afterText === 'string'
        ) {
          setContent({ beforeText: result.beforeText, afterText: result.afterText })
          return
        }
        if (
          result &&
          typeof result === 'object' &&
          'error' in result &&
          typeof result.error === 'string'
        ) {
          setLoadError(result.error)
          return
        }
        setLoadError('Failed to load full diff')
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err))
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
  }, [canRenderInline, change])

  if (isLoading && !content) {
    return (
      <SnapshotSummaryNotice before={change.before} after={change.after} filePath={filePath}>
        <div className="flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin" />
          <span>{t('thinking.thinkingEllipsis')}</span>
        </div>
      </SnapshotSummaryNotice>
    )
  }

  if (loadError && !content) {
    return (
      <SnapshotSummaryNotice before={change.before} after={change.after} filePath={filePath}>
        <div className="text-destructive/80">{loadError}</div>
      </SnapshotSummaryNotice>
    )
  }

  if (!content) {
    return <SnapshotSummaryNotice before={change.before} after={change.after} filePath={filePath} />
  }

  return (
    <CompactEditDiff oldStr={content.beforeText} newStr={content.afterText} filePath={filePath} />
  )
}

