const ANSI_ESCAPE_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'g')

const DEFAULT_STREAM_MAX_CHARS = 5_000
const DEFAULT_STREAM_MAX_LINES = 120
const DEFAULT_HEAD_LINES = 8
const DEFAULT_TAIL_LINES = 60
const DEFAULT_IMPORTANT_LINE_LIMIT = 40

const ERROR_LIKE_RE = new RegExp(
  [
    'error',
    'failed',
    'exception',
    'traceback',
    'fatal',
    'panic',
    'cannot',
    'unable',
    'undefined reference',
    'syntax error',
    'test(?:s)? failed?'
  ].join('|'),
  'i'
)
const WARNING_LIKE_RE = /\bwarn(?:ing)?\b/i

export interface ShellOutputCompactOptions {
  stdoutMaxChars?: number
  stderrMaxChars?: number
  streamMaxLines?: number
  headLines?: number
  tailLines?: number
  importantLineLimit?: number
}

interface StreamPreview {
  text: string
  chars: number
  lines: number
  errorLikeLines: number
  warningLikeLines: number
  truncated: boolean
}

type RequiredStreamOptions = Required<
  Pick<
    ShellOutputCompactOptions,
    'streamMaxLines' | 'headLines' | 'tailLines' | 'importantLineLimit'
  >
>

function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_RE, '')
}

function normalizeShellText(value: string): string {
  return stripAnsi(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isNonZeroExitCode(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value !== 0
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function countLines(normalized: string): number {
  return normalized.length === 0 ? 0 : normalized.split('\n').length
}

function looksBinary(normalized: string): boolean {
  const sample = normalized.slice(0, 256)
  if (!sample) return false

  let bad = 0
  for (let index = 0; index < sample.length; index += 1) {
    const code = sample.charCodeAt(index)
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0xfffd) {
      bad += 1
    }
  }
  return bad / sample.length > 0.1
}

function collectMatchingLines(lines: string[], pattern: RegExp, limit: number): string[] {
  const seen = new Set<string>()
  const matches: string[] = []

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim()
    if (!line || !pattern.test(line)) continue

    const key = line.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    matches.unshift(line)
    if (matches.length >= limit) break
  }

  return matches
}

function clampPreservingEdges(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text

  const marker = `\n... [truncated, ${text.length} chars total]\n`
  const budget = maxChars - marker.length
  if (budget <= 0) return text.slice(0, maxChars)

  const headChars = Math.min(1_200, Math.max(0, Math.floor(budget * 0.35)))
  const tailChars = Math.max(0, budget - headChars)
  return `${text.slice(0, headChars)}${marker}${text.slice(-tailChars)}`
}

function compactStream(
  raw: string,
  maxChars: number,
  options: RequiredStreamOptions
): StreamPreview {
  const normalized = normalizeShellText(raw)
  const chars = normalized.length
  const lines = normalized ? normalized.split('\n') : []
  const lineCount = countLines(normalized)
  const errorLines = collectMatchingLines(lines, ERROR_LIKE_RE, options.importantLineLimit)
  const warningLines = collectMatchingLines(lines, WARNING_LIKE_RE, options.importantLineLimit)

  if (!normalized) {
    return {
      text: '',
      chars,
      lines: lineCount,
      errorLikeLines: 0,
      warningLikeLines: 0,
      truncated: false
    }
  }

  if (looksBinary(normalized)) {
    return {
      text: `[Binary or non-text output omitted, ${raw.length} chars total]`,
      chars,
      lines: lineCount,
      errorLikeLines: errorLines.length,
      warningLikeLines: warningLines.length,
      truncated: true
    }
  }

  if (chars <= maxChars && lineCount <= options.streamMaxLines) {
    return {
      text: normalized,
      chars,
      lines: lineCount,
      errorLikeLines: errorLines.length,
      warningLikeLines: warningLines.length,
      truncated: false
    }
  }

  const head = lines.slice(0, options.headLines)
  const tail = lines.slice(-options.tailLines)
  const omittedLineCount = Math.max(lineCount - head.length - tail.length, 0)
  const sections: string[] = []

  if (head.length > 0) {
    sections.push(`[first ${head.length} lines]\n${head.join('\n')}`)
  }

  if (errorLines.length > 0) {
    sections.push(`[error-like lines]\n${errorLines.join('\n')}`)
  } else if (warningLines.length > 0) {
    sections.push(`[warning-like lines]\n${warningLines.join('\n')}`)
  }

  if (tail.length > 0) {
    const header =
      omittedLineCount > 0
        ? `[last ${tail.length} lines, omitted ${omittedLineCount} earlier lines]`
        : `[last ${tail.length} lines]`
    sections.push(`${header}\n${tail.join('\n')}`)
  }

  return {
    text: clampPreservingEdges(sections.join('\n\n'), maxChars),
    chars,
    lines: lineCount,
    errorLikeLines: errorLines.length,
    warningLikeLines: warningLines.length,
    truncated: true
  }
}

function resolvedOptions(options: ShellOutputCompactOptions): Required<ShellOutputCompactOptions> {
  return {
    stdoutMaxChars: Math.max(1_000, Math.floor(options.stdoutMaxChars ?? DEFAULT_STREAM_MAX_CHARS)),
    stderrMaxChars: Math.max(1_000, Math.floor(options.stderrMaxChars ?? DEFAULT_STREAM_MAX_CHARS)),
    streamMaxLines: Math.max(20, Math.floor(options.streamMaxLines ?? DEFAULT_STREAM_MAX_LINES)),
    headLines: Math.max(0, Math.floor(options.headLines ?? DEFAULT_HEAD_LINES)),
    tailLines: Math.max(1, Math.floor(options.tailLines ?? DEFAULT_TAIL_LINES)),
    importantLineLimit: Math.max(
      0,
      Math.floor(options.importantLineLimit ?? DEFAULT_IMPORTANT_LINE_LIMIT)
    )
  }
}

export function compactShellText(
  value: string,
  options: ShellOutputCompactOptions = {}
): { text: string; truncated: boolean; chars: number; lines: number } {
  const opts = resolvedOptions(options)
  const preview = compactStream(value, opts.stdoutMaxChars, opts)
  return {
    text: preview.text,
    truncated: preview.truncated,
    chars: preview.chars,
    lines: preview.lines
  }
}

export function compactShellOutputPayload(
  payload: Record<string, unknown>,
  options: ShellOutputCompactOptions = {}
): Record<string, unknown> {
  const opts = resolvedOptions(options)
  const result: Record<string, unknown> = { ...payload }
  const stdout = stringField(payload.stdout)
  const output = stringField(payload.output)
  const stderr = stringField(payload.stderr)
  const error = stringField(payload.error)
  const hasCombinedOutput = 'output' in payload && output.length > 0
  const primaryOutputKey: 'stdout' | 'output' =
    hasCombinedOutput || !('stdout' in payload) ? 'output' : 'stdout'
  const primaryOutput = hasCombinedOutput ? output : stdout || output

  const stdoutPreview = compactStream(primaryOutput, opts.stdoutMaxChars, opts)
  const stderrPreview = compactStream(stderr, opts.stderrMaxChars, opts)
  const errorPreview = compactStream(error, opts.stderrMaxChars, opts)
  const truncated = stdoutPreview.truncated || stderrPreview.truncated || errorPreview.truncated
  const totalChars = stdoutPreview.chars + stderrPreview.chars + errorPreview.chars
  const totalLines = stdoutPreview.lines + stderrPreview.lines + errorPreview.lines
  const errorLikeLines =
    stdoutPreview.errorLikeLines + stderrPreview.errorLikeLines + errorPreview.errorLikeLines
  const warningLikeLines =
    stdoutPreview.warningLikeLines + stderrPreview.warningLikeLines + errorPreview.warningLikeLines

  if (primaryOutputKey === 'stdout') {
    result.stdout = stdoutPreview.text
    if ('output' in result) result.output = ''
  } else if ('output' in payload || stdoutPreview.text) {
    result.output = stdoutPreview.text
    if ('stdout' in result) result.stdout = ''
    if ('stderr' in result) result.stderr = ''
  }

  if (!hasCombinedOutput && ('stderr' in payload || stderrPreview.text)) {
    result.stderr = stderrPreview.text
  }
  if ('error' in payload || errorPreview.text) {
    result.error = errorPreview.text
  }

  if (truncated || isRecord(payload.summary)) {
    const existingSummary = isRecord(payload.summary) ? payload.summary : {}
    const compactedElsewhere =
      existingSummary.mode === 'compact' ||
      existingSummary.mode === 'tail' ||
      existingSummary.truncated === true
    result.summary = {
      ...existingSummary,
      mode: truncated ? 'compact' : (existingSummary.mode ?? 'full'),
      noisy: Boolean(existingSummary.noisy) || truncated || compactedElsewhere,
      truncated: Boolean(existingSummary.truncated) || truncated || compactedElsewhere,
      focus: error || stderr ? 'error' : truncated ? 'tail' : 'full',
      outputPolicy: 'bounded-shell-output',
      totalChars: Math.max(numberField(existingSummary, 'totalChars') ?? 0, totalChars),
      totalLines: Math.max(numberField(existingSummary, 'totalLines') ?? 0, totalLines),
      stdoutChars: Math.max(numberField(existingSummary, 'stdoutChars') ?? 0, stdoutPreview.chars),
      stderrChars: Math.max(
        numberField(existingSummary, 'stderrChars') ?? 0,
        stderrPreview.chars + errorPreview.chars
      ),
      stdoutLines: Math.max(numberField(existingSummary, 'stdoutLines') ?? 0, stdoutPreview.lines),
      stderrLines: Math.max(
        numberField(existingSummary, 'stderrLines') ?? 0,
        stderrPreview.lines + errorPreview.lines
      ),
      errorLikeLines,
      warningLikeLines,
      exitCodeNonZero: isNonZeroExitCode(payload.exitCode)
    }
  }

  return result
}
