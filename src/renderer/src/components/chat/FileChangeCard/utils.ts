// Pure utility functions and types extracted from FileChangeCard.tsx

import type { ToolResultContent } from '@renderer/lib/api/types'
import type { AgentRunFileChange } from '@renderer/stores/agent-store'
import { decodeStructuredToolResult } from '@renderer/lib/tools/tool-result-format'
import { type DiffViewerChunk, type DiffViewerLine } from '../CodeDiffViewer'

interface FileChangeCardProps {
  /** Tool name: Write, Edit, Delete */
  name: string
  input: Record<string, unknown>
  output?: ToolResultContent
  status: ToolCallStatus | 'completed'
  error?: string
  startedAt?: number
  completedAt?: number
  trackedChange?: AgentRunFileChange
  forceOpen?: boolean
}

// ── Helpers ──────────────────────────────────────────────────────

function detectLang(filePath: string): string {
  const ext = filePath.includes('.') ? (filePath.split('.').pop()?.toLowerCase() ?? '') : ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    rs: 'rust',
    go: 'go',
    json: 'json',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    svg: 'xml',
    md: 'markdown',
    mdx: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cxx: 'cpp',
    cc: 'cpp',
    hpp: 'cpp',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    dockerfile: 'docker',
    makefile: 'makefile',
    r: 'r',
    lua: 'lua',
    dart: 'dart',
    ini: 'ini',
    env: 'bash',
    conf: 'ini'
  }
  return map[ext] ?? 'text'
}

function shortPath(filePath: string): string {
  return filePath.split(/[\\/]/).slice(-2).join('/')
}

function fileName(filePath: string): string {
  const parts = filePath.split(/[\\/]/)
  return parts[parts.length - 1] || filePath
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n')
}

function lineCount(text: string): number {
  const normalized = normalizeLineEndings(text)
  return normalized.length === 0 ? 0 : normalized.split('\n').length
}

function formatCompactCount(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(value)
}

type FilePreviewTone = 'create' | 'edit'
type CompactActionOp = 'create' | 'modify' | 'delete'

function snapshotText(
  snapshot: AgentRunFileChange['before'] | AgentRunFileChange['after']
): string {
  return snapshot.text ?? snapshot.previewText ?? ''
}

function snapshotLineTotal(
  snapshot: AgentRunFileChange['before'] | AgentRunFileChange['after']
): number {
  return typeof snapshot.lineCount === 'number'
    ? snapshot.lineCount
    : lineCount(snapshotText(snapshot))
}

function canRenderInlineSnapshot(
  snapshot: AgentRunFileChange['before'] | AgentRunFileChange['after']
): boolean {
  return typeof snapshot.text === 'string'
}

type DiffLine = DiffViewerLine

function computeLargeDiff(a: string[], b: string[]): DiffLine[] {
  const result: DiffLine[] = []
  const m = a.length
  const n = b.length

  let start = 0
  while (start < m && start < n && a[start] === b[start]) {
    result.push({ type: 'keep', text: a[start], oldNum: start + 1, newNum: start + 1 })
    start += 1
  }

  let endA = m - 1
  let endB = n - 1
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA -= 1
    endB -= 1
  }

  for (let index = start; index <= endA; index += 1) {
    result.push({ type: 'del', text: a[index], oldNum: index + 1 })
  }

  for (let index = start; index <= endB; index += 1) {
    result.push({ type: 'add', text: b[index], newNum: index + 1 })
  }

  for (let offset = 1; endA + offset < m && endB + offset < n; offset += 1) {
    result.push({
      type: 'keep',
      text: a[endA + offset],
      oldNum: endA + offset + 1,
      newNum: endB + offset + 1
    })
  }

  return result
}

function computeDiff(oldStr: string, newStr: string): DiffLine[] {
  const a = normalizeLineEndings(oldStr).split('\n')
  const b = normalizeLineEndings(newStr).split('\n')
  const m = a.length,
    n = b.length

  if (m * n > 100000) {
    return computeLargeDiff(a, b)
  }

  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])

  const result: DiffLine[] = []
  let i = m,
    j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.push({ type: 'keep', text: a[i - 1], oldNum: i, newNum: j })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'add', text: b[j - 1], newNum: j })
      j--
    } else {
      result.push({ type: 'del', text: a[i - 1], oldNum: i })
      i--
    }
  }
  return result.reverse()
}

function summarizeDiff(lines: DiffLine[]): { added: number; deleted: number } {
  return lines.reduce(
    (acc, line) => {
      if (line.type === 'add') acc.added += 1
      if (line.type === 'del') acc.deleted += 1
      return acc
    },
    { added: 0, deleted: 0 }
  )
}

type DiffChunk = DiffViewerChunk

function foldContext(lines: DiffLine[], ctx: number = 2): DiffChunk[] {
  const chunks: DiffChunk[] = []
  let keepRun: DiffLine[] = []

  const flushKeep = (): void => {
    if (keepRun.length <= ctx * 2 + 1) {
      chunks.push({ type: 'lines', lines: keepRun })
    } else {
      chunks.push({ type: 'lines', lines: keepRun.slice(0, ctx) })
      chunks.push({
        type: 'collapsed',
        count: keepRun.length - ctx * 2,
        lines: keepRun.slice(ctx, -ctx)
      })
      chunks.push({ type: 'lines', lines: keepRun.slice(-ctx) })
    }
    keepRun = []
  }

  for (const line of lines) {
    if (line.type === 'keep') {
      keepRun.push(line)
    } else {
      if (keepRun.length > 0) flushKeep()
      if (chunks.length > 0 && chunks[chunks.length - 1].type === 'lines') {
        ;(chunks[chunks.length - 1] as { type: 'lines'; lines: DiffLine[] }).lines.push(line)
      } else {
        chunks.push({ type: 'lines', lines: [line] })
      }
    }
  }
  if (keepRun.length > 0) flushKeep()
  return chunks
}

function diffDisplayLineNumber(line: DiffLine): number | undefined {
  if (line.type === 'del') return line.oldNum
  return line.newNum ?? line.oldNum
}

function buildDiffCopyText(lines: DiffLine[]): string {
  return lines
    .map((line) => {
      const lineNumber = diffDisplayLineNumber(line)
      const marker = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '
      return `${lineNumber ?? ''}\t${marker}${line.text}`
    })
    .join('\n')
}

function diffLineStyle(line: DiffLine | undefined): React.CSSProperties {
  if (line?.type === 'add') {
    return {
      display: 'block',
      backgroundColor: 'rgba(46, 160, 67, 0.17)',
      borderLeft: '2px solid rgb(46, 160, 67)',
      paddingLeft: '0.5rem'
    }
  }
  if (line?.type === 'del') {
    return {
      display: 'block',
      backgroundColor: 'rgba(248, 81, 73, 0.16)',
      borderLeft: '2px solid rgb(248, 81, 73)',
      paddingLeft: '0.5rem'
    }
  }
  // keep: transparent bar to preserve horizontal alignment with changed lines
  return {
    display: 'block',
    borderLeft: '2px solid transparent',
    paddingLeft: '0.5rem'
  }
}

interface TrackedDiffContent {
  beforeText: string
  afterText: string
}

// ── Status Icon ──────────────────────────────────────────────────

interface ResolvedEditPayload {
  oldText: string
  newText: string
  oldPreview: string
  newPreview: string
  oldChars: number
  newChars: number
  oldTruncated: boolean
  newTruncated: boolean
}

interface ResolvedWritePayload {
  text: string
  preview: string
  lineTotal: number
}

function resolveEditPayload(input: Record<string, unknown>): ResolvedEditPayload {
  const oldText = typeof input.old_string === 'string' ? input.old_string : ''
  const newText = typeof input.new_string === 'string' ? input.new_string : ''
  const oldPreview =
    typeof input.old_string_preview === 'string' ? input.old_string_preview : oldText
  const newPreview =
    typeof input.new_string_preview === 'string' ? input.new_string_preview : newText
  const oldChars =
    typeof input.old_string_chars === 'number' ? input.old_string_chars : oldText.length
  const newChars =
    typeof input.new_string_chars === 'number' ? input.new_string_chars : newText.length
  const oldTruncated = Boolean(input.old_string_truncated)
  const newTruncated = Boolean(input.new_string_truncated)

  return {
    oldText,
    newText,
    oldPreview,
    newPreview,
    oldChars,
    newChars,
    oldTruncated,
    newTruncated
  }
}

function resolveWritePayload(input: Record<string, unknown>): ResolvedWritePayload {
  const text = typeof input.content === 'string' ? input.content : ''
  const preview = typeof input.content_preview === 'string' ? input.content_preview : text
  const lineTotal =
    typeof input.content_lines === 'number'
      ? input.content_lines
      : text
        ? lineCount(text)
        : preview
          ? lineCount(preview)
          : 0

  return { text, preview, lineTotal }
}

function hasPendingEditPreviewContent(input: Record<string, unknown>): boolean {
  const filePath = String(input.file_path ?? input.path ?? '').trim()
  const explanation = typeof input.explanation === 'string' ? input.explanation.trim() : ''
  const oldStr = typeof input.old_string === 'string' ? input.old_string : ''
  const newStr = typeof input.new_string === 'string' ? input.new_string : ''
  const oldPreview =
    typeof input.old_string_preview === 'string' ? input.old_string_preview : oldStr
  const newPreview =
    typeof input.new_string_preview === 'string' ? input.new_string_preview : newStr
  const oldChars =
    typeof input.old_string_chars === 'number' ? input.old_string_chars : oldStr.length
  const newChars =
    typeof input.new_string_chars === 'number' ? input.new_string_chars : newStr.length

  return Boolean(
    filePath ||
    explanation ||
    oldPreview ||
    newPreview ||
    oldChars > 0 ||
    newChars > 0 ||
    input.old_string_truncated ||
    input.new_string_truncated
  )
}

function resolveEditSummaryDiff(
  payload: ResolvedEditPayload,
  trackedChange?: AgentRunFileChange
): { added: number; deleted: number; oldStr: string; newStr: string } | null {
  if (
    trackedChange &&
    canRenderInlineSnapshot(trackedChange.before) &&
    canRenderInlineSnapshot(trackedChange.after)
  ) {
    const oldStr = snapshotText(trackedChange.before)
    const newStr = snapshotText(trackedChange.after)
    return {
      ...summarizeDiff(computeDiff(oldStr, newStr)),
      oldStr,
      newStr
    }
  }

  if (payload.oldTruncated || payload.newTruncated) return null

  const oldStr = payload.oldText || payload.oldPreview
  const newStr = payload.newText || payload.newPreview

  if (!oldStr && !newStr) return null

  return {
    ...summarizeDiff(computeDiff(oldStr, newStr)),
    oldStr,
    newStr
  }
}

function trackedStatusLabelKey(change: AgentRunFileChange): string {
  if (change.status === 'reverted') return 'fileChange.status.reverted'
  return 'fileChange.status.pending'
}

function trackedTransportLabelKey(change: AgentRunFileChange): string {
  return change.transport === 'ssh' ? 'fileChange.transport.ssh' : 'fileChange.transport.local'
}

function trackedStatusTone(change: AgentRunFileChange): string {
  if (change.status === 'reverted')
    return 'bg-muted text-foreground/70 dark:bg-zinc-500/10 dark:text-zinc-300'
  return change.transport === 'ssh'
    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
}

function trackedStatusDotTone(change: AgentRunFileChange): string {
  if (change.status === 'reverted') return 'bg-zinc-500'
  return change.transport === 'ssh' ? 'bg-sky-400' : 'bg-zinc-400'
}

// ── Main Component ───────────────────────────────────────────────

