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


export function StatusIndicator({
  status
}: {
  status: FileChangeCardProps['status']
}): React.JSX.Element | null {
  switch (status) {
    case 'running':
      return <Loader2 className="size-3.5 animate-spin text-blue-500 shrink-0" />
    case 'error':
      return <XCircle className="size-3.5 text-destructive shrink-0" />
    case 'canceled':
      return <XCircle className="size-3.5 text-muted-foreground shrink-0" />
    case 'completed':
      return <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
    case 'pending_approval':
      return <Loader2 className="size-3.5 animate-spin text-amber-500 shrink-0" />
    case 'streaming':
      return <Loader2 className="size-3.5 animate-spin text-violet-500 shrink-0" />
    default:
      return null
  }
}

export function CompactStatusDot({
  status
}: {
  status: FileChangeCardProps['status']
}): React.JSX.Element {
  switch (status) {
    case 'completed':
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="size-2 rounded-full bg-emerald-400" />
        </span>
      )
    case 'running':
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="absolute size-2 rounded-full bg-blue-500/30 animate-ping" />
          <span className="size-2 rounded-full bg-blue-500" />
        </span>
      )
    case 'error':
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="size-2 rounded-full bg-red-400" />
        </span>
      )
    case 'canceled':
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="size-2 rounded-full border border-muted-foreground/45" />
        </span>
      )
    case 'pending_approval':
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="absolute size-2 rounded-full bg-amber-500/30 animate-ping" />
          <span className="size-2 rounded-full bg-amber-400" />
        </span>
      )
    case 'streaming':
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="absolute size-2 rounded-full bg-violet-500/30 animate-ping" />
          <span className="size-2 rounded-full bg-violet-400" />
        </span>
      )
    default:
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="size-2 rounded-full border border-zinc-600" />
        </span>
      )
  }
}

// ── File Icon ────────────────────────────────────────────────────

export function FileIcon({ name }: { name: string }): React.JSX.Element {
  switch (name) {
    case 'Write':
      return <FilePlus2 className="size-4 text-green-500" />
    case 'Delete':
      return <FileX2 className="size-4 text-destructive" />
    case 'Edit':
      return <FileEdit className="size-4 text-amber-500" />
    default:
      return <FileCode className="size-4 text-muted-foreground" />
  }
}

// ── Change Stats Badge ───────────────────────────────────────────

export function ChangeStats({
  name,
  input,
  trackedChange,
  minimal = false
}: {
  name: string
  input: Record<string, unknown>
  trackedChange?: AgentRunFileChange
  writeOp?: 'create' | 'modify'
  minimal?: boolean
}): React.JSX.Element | null {
  const { t } = useTranslation('chat')
  const trackedStats = React.useMemo(() => {
    if (!trackedChange || trackedChange.op === 'create') return null
    if (
      !canRenderInlineSnapshot(trackedChange.before) ||
      !canRenderInlineSnapshot(trackedChange.after)
    ) {
      return null
    }
    return summarizeDiff(
      computeDiff(snapshotText(trackedChange.before), snapshotText(trackedChange.after))
    )
  }, [trackedChange])
  const resolvedEdit = React.useMemo(() => resolveEditPayload(input), [input])
  const resolvedWrite = React.useMemo(() => resolveWritePayload(input), [input])

  if (trackedChange) {
    if (trackedChange.op === 'create') {
      const lines = snapshotLineTotal(trackedChange.after)
      if (minimal) {
        return (
          <span className="flex items-center gap-1 text-[10px]">
            <span className="text-green-400/70">+{lines}</span>
            <span className="text-red-400/70">-0</span>
          </span>
        )
      }
      return (
        <span className="flex items-center gap-1.5 text-[10px]">
          <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-green-500 font-medium">
            {t('fileChange.new')}
          </span>
          <span className="text-green-400/70">+{lines}</span>
        </span>
      )
    }

    if (!trackedStats) return null
    return (
      <span className="flex items-center gap-1 text-[10px]">
        <span className="text-green-400/70">+{trackedStats.added}</span>
        <span className="text-red-400/70">-{trackedStats.deleted}</span>
      </span>
    )
  }

  if (name === 'Write') {
    if (minimal) {
      return (
        <span className="flex items-center gap-1 text-[10px]">
          <span className="text-green-400/70">+{resolvedWrite.lineTotal}</span>
          <span className="text-red-400/70">-0</span>
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1.5 text-[10px]">
        <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-green-500 font-medium">
          {t('fileChange.new')}
        </span>
        <span className="text-green-400/70">+{resolvedWrite.lineTotal}</span>
      </span>
    )
  }
  if (name === 'Edit') {
    if (!resolvedEdit.oldPreview && !resolvedEdit.newPreview) return null
    return (
      <span className="flex items-center gap-1 text-[10px]">
        <span className="text-muted-foreground/50">
          {t('fileChange.charTransition', {
            from: resolvedEdit.oldChars,
            to: resolvedEdit.newChars
          })}
        </span>
      </span>
    )
  }
  if (name === 'Delete') {
    if (minimal) return null
    return (
      <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400 font-medium">
        {t('fileChange.deleted')}
      </span>
    )
  }
  return null
}

export function WriteRealtimeStats({
  input,
  resolvedWrite,
  op
}: {
  input: Record<string, unknown>
  resolvedWrite: ResolvedWritePayload
  op: Extract<CompactActionOp, 'create' | 'modify'>
}): React.JSX.Element | null {
  const { t } = useTranslation('chat')
  const isCreate = op === 'create'
  const charTotal =
    typeof input.content_chars === 'number'
      ? input.content_chars
      : resolvedWrite.text.length || resolvedWrite.preview.length
  const isPreviewOnly = Boolean(input.content_truncated || input.content_omitted)

  if (resolvedWrite.lineTotal <= 0 && charTotal <= 0 && !isPreviewOnly) return null

  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[10px]">
      {resolvedWrite.lineTotal > 0 && (
        <span
          className={cn(
            'rounded px-1.5 py-0.5 font-medium',
            isCreate
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
          )}
          title={t('fileChange.lineCount', { count: resolvedWrite.lineTotal })}
        >
          {t('fileChange.compactLineCount', {
            value: `${isCreate ? '+' : ''}${formatCompactCount(resolvedWrite.lineTotal)}`
          })}
        </span>
      )}
      {charTotal > 0 && (
        <span
          className="hidden rounded bg-background/45 px-1.5 py-0.5 text-muted-foreground/75 dark:bg-white/[0.04] sm:inline"
          title={t('fileChange.charCount', { count: charTotal })}
        >
          {t('fileChange.compactCharCount', { value: formatCompactCount(charTotal) })}
        </span>
      )}
      {isPreviewOnly && (
        <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-500 dark:text-violet-300">
          {t('fileChange.previewOnly')}
        </span>
      )}
    </span>
  )
}

// ── Inline Diff View ─────────────────────────────────────────────

