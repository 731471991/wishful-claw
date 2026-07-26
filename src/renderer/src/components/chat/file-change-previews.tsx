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


function FilePreviewShell({
  filePath,
  added,
  deleted,
  copyText,
  tone,
  autoScrollKey,
  maxHeight = 320,
  children
}: {
  filePath: string
  added: number
  deleted: number
  copyText: string
  tone: FilePreviewTone
  autoScrollKey?: string | number
  maxHeight?: number
  children: React.ReactNode
}): React.JSX.Element {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (autoScrollKey === undefined) return
    const frame = window.requestAnimationFrame(() => {
      const el = scrollRef.current
      if (!el) return
      el.scrollTop = el.scrollHeight
    })
    return () => window.cancelAnimationFrame(frame)
  }, [autoScrollKey])

  return (
    <div className="overflow-hidden rounded-lg border border-border/50 bg-background/85 dark:border-white/[0.08] dark:bg-[#111214]">
      <div className="flex min-h-7 items-center justify-between gap-3 border-b border-border/50 bg-muted/30 px-3 py-1 dark:border-white/[0.08] dark:bg-white/[0.035]">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="truncate text-[11px] font-medium text-muted-foreground"
            title={filePath}
            style={{ fontFamily: MONO_FONT }}
          >
            {fileName(filePath) || 'file'}
          </span>
          <span className="shrink-0 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            +{added}
          </span>
          <span className="shrink-0 text-[11px] font-medium text-red-600 dark:text-red-400">
            -{deleted}
          </span>
        </div>
        <CompactDiffCopyButton text={copyText} />
      </div>
      <div
        ref={scrollRef}
        className="overflow-auto bg-background dark:bg-[#111214]"
        data-tone={tone}
        style={{ maxHeight, fontFamily: MONO_FONT }}
      >
        {children}
      </div>
    </div>
  )
}

function CodeFrame({
  content,
  filePath,
  tone
}: {
  content: string
  filePath: string
  tone: FilePreviewTone
}): React.JSX.Element {
  const lineNumberColor =
    tone === 'create'
      ? 'color-mix(in srgb, #16a34a 72%, var(--muted-foreground) 28%)'
      : 'var(--muted-foreground)'

  return (
    <LazySyntaxHighlighter
      language={detectLang(filePath)}
      showLineNumbers
      customStyle={{
        margin: 0,
        padding: '0.5rem',
        borderRadius: 0,
        fontSize: '11px',
        overflow: 'visible',
        fontFamily: MONO_FONT
      }}
      codeTagProps={{ style: { fontFamily: 'inherit' } }}
      lineNumberStyle={{ color: lineNumberColor, opacity: 0.72, userSelect: 'none' }}
    >
      {content || ' '}
    </LazySyntaxHighlighter>
  )
}


function NewFileContent({
  content,
  filePath,
  isStreaming,
  tone = 'create'
}: {
  content: string
  filePath: string
  isStreaming?: boolean
  tone?: FilePreviewTone
}): React.JSX.Element {
  const { t } = useTranslation('chat')
  const normalizedContent = React.useMemo(() => normalizeLineEndings(content), [content])
  const contentLines = React.useMemo(() => normalizedContent.split('\n'), [normalizedContent])
  const previewLineLimit = 240
  const lines = normalizedContent.length === 0 ? 0 : contentLines.length
  const truncated = !isStreaming && lines > previewLineLimit
  const [expanded, setExpanded] = React.useState(false)
  const displayed =
    truncated && !expanded ? contentLines.slice(0, previewLineLimit).join('\n') : normalizedContent

  return (
    <div className="space-y-2 px-3 py-3">
      <FilePreviewShell
        filePath={filePath}
        added={lines}
        deleted={0}
        copyText={normalizedContent}
        tone={tone}
        autoScrollKey={isStreaming ? normalizedContent.length : undefined}
        maxHeight={isStreaming ? 400 : 300}
      >
        <CodeFrame content={displayed} filePath={filePath} tone={tone} />
      </FilePreviewShell>
      {isStreaming ? (
        <p className="px-1 text-[10px] text-muted-foreground/70 dark:text-zinc-500">
          {t('fileChange.streaming')}
        </p>
      ) : null}
      {truncated && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full text-center text-[10px] text-muted-foreground transition-colors hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-200"
        >
          {t('fileChange.moreLines', { count: lines - previewLineLimit })}
        </button>
      )}
    </div>
  )
}

function SnapshotSummaryNotice({
  before,
  after,
  filePath,
  children
}: {
  before?: AgentRunFileChange['before']
  after: AgentRunFileChange['after']
  filePath?: string
  children?: React.ReactNode
}): React.JSX.Element {
  const details = [
    typeof before?.lineCount === 'number' ? `before ${before.lineCount} lines` : null,
    typeof after.lineCount === 'number' ? `after ${after.lineCount} lines` : null,
    `${after.size} bytes`,
    after.hash ? `sha ${after.hash.slice(0, 12)}` : null
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="space-y-3 px-3 py-3 text-[11px] text-muted-foreground dark:text-zinc-400">
      <div className="space-y-1">
        <p>Large file snapshot summarized to avoid storing full before/after text in memory.</p>
        <p
          className="font-mono text-[10px] text-muted-foreground/70 dark:text-zinc-600"
          style={{ fontFamily: MONO_FONT }}
        >
          {details}
        </p>
      </div>
      {children}
      {after.previewText && (
        <LazySyntaxHighlighter
          language={detectLang(filePath ?? '')}
          showLineNumbers
          wrapLongLines
          customStyle={{
            margin: 0,
            padding: '0.5rem',
            borderRadius: '0.375rem',
            fontSize: '11px',
            maxHeight: '180px',
            overflow: 'auto',
            fontFamily: MONO_FONT
          }}
          codeTagProps={{ style: { fontFamily: 'inherit' } }}
        >
          {`${after.previewText}${after.tailPreviewText ? '\n…\n' : ''}${after.tailPreviewText ?? ''}`}
        </LazySyntaxHighlighter>
      )}
    </div>
  )
}

function PendingEditPreview({ input }: { input: Record<string, unknown> }): React.JSX.Element {
  const { t } = useTranslation('chat')
  const filePath = String(input.file_path ?? input.path ?? '')
  const explanation = input.explanation ? String(input.explanation) : null
  const oldStr = typeof input.old_string === 'string' ? input.old_string : ''
  const newStr = typeof input.new_string === 'string' ? input.new_string : ''
  const newPreview =
    typeof input.new_string_preview === 'string' ? input.new_string_preview : newStr
  const oldChars =
    typeof input.old_string_chars === 'number' ? input.old_string_chars : oldStr.length
  const newChars =
    typeof input.new_string_chars === 'number' ? input.new_string_chars : newStr.length
  const showingExcerpt = Boolean(input.old_string_truncated || input.new_string_truncated)
  const hasCounts = oldChars > 0 || newChars > 0
  const hasNewPreview = Boolean(newPreview)

  return (
    <div className="space-y-2 text-[11px] text-foreground/85 dark:text-zinc-300">
      <div className="space-y-2 px-3 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {filePath && !hasNewPreview && (
            <span
              className="font-mono text-[10px] text-muted-foreground dark:text-zinc-500"
              style={{ fontFamily: MONO_FONT }}
            >
              {shortPath(filePath)}
            </span>
          )}
          {hasCounts && (
            <span className="text-[10px] text-muted-foreground dark:text-zinc-500">
              {t('fileChange.charTransition', { from: oldChars, to: newChars })}
            </span>
          )}
        </div>
        {explanation && (
          <p className="text-[11px] text-muted-foreground dark:text-zinc-400">{explanation}</p>
        )}
        {showingExcerpt && (
          <p className="text-[10px] text-muted-foreground/70 dark:text-zinc-600">
            {t('fileChange.showingExcerpt')}
          </p>
        )}
      </div>
      {hasNewPreview && (
        <NewFileContent content={newPreview} filePath={filePath} isStreaming tone="edit" />
      )}
    </div>
  )
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

function PendingWritePreview({
  input,
  isStreaming,
  op = 'modify'
}: {
  input: Record<string, unknown>
  isStreaming: boolean
  op?: Extract<CompactActionOp, 'create' | 'modify'>
}): React.JSX.Element {
  const filePath = String(input.file_path ?? input.path ?? '')
  const content = typeof input.content === 'string' ? input.content : null
  const preview = typeof input.content_preview === 'string' ? input.content_preview : null
  const previewTail =
    typeof input.content_preview_tail === 'string' ? input.content_preview_tail : null
  const previewBase =
    content ?? (previewTail ? `${preview ?? ''}\n...\n${previewTail}` : preview) ?? ''
  const visiblePreview =
    previewBase &&
    input.content_truncated &&
    !previewTail &&
    content === null &&
    !previewBase.startsWith('…')
      ? `${previewBase}\n...`
      : previewBase

  if (!visiblePreview) return <></>

  return (
    <NewFileContent
      content={visiblePreview}
      filePath={filePath}
      isStreaming={isStreaming}
      tone={op === 'create' ? 'create' : 'edit'}
    />
  )
}

