import { decodeStructuredToolResult } from '@renderer/lib/tools/tool-result-format'
import type { ImageBlock, ToolResultContent } from '@renderer/lib/api/types'
import type {
  ToolCallCardProps,
  WidgetToolPayload,
  ShellOutputSummary,
  LiveShellOutputState,
  ParsedShellResult,
  SearchOutputMeta,
  ParsedGrepEntry,
  LsEntry,
  SearchVisualState
} from './types'
import {
  ANSI_ESCAPE_RE,
  LIVE_SHELL_OUTPUT_MAX_CHARS
} from './types'

// ── Record / equality helpers ──

export function shallowEqualRecord(prev: Record<string, unknown>, next: Record<string, unknown>): boolean {
  if (prev === next) return true
  const prevKeys = Object.keys(prev)
  const nextKeys = Object.keys(next)
  if (prevKeys.length !== nextKeys.length) return false
  for (const key of prevKeys) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) return false
    if (!Object.is(prev[key], next[key])) return false
  }
  return true
}

export function toolResultContentEqual(
  prev: ToolResultContent | undefined,
  next: ToolResultContent | undefined
): boolean {
  if (prev === next) return true
  if (prev === undefined || next === undefined) return false
  if (typeof prev === 'string' || typeof next === 'string') return prev === next
  if (prev.length !== next.length) return false
  for (let i = 0; i < prev.length; i++) {
    const prevBlock = prev[i]
    const nextBlock = next[i]
    if (prevBlock === nextBlock) continue
    if (prevBlock.type !== nextBlock.type) return false
    if (prevBlock.type === 'text' && nextBlock.type === 'text') {
      if (prevBlock.text !== nextBlock.text) return false
      continue
    }
    if (prevBlock.type === 'image' && nextBlock.type === 'image') {
      if (
        prevBlock.source.type !== nextBlock.source.type ||
        prevBlock.source.mediaType !== nextBlock.source.mediaType ||
        prevBlock.source.data !== nextBlock.source.data ||
        prevBlock.source.url !== nextBlock.source.url ||
        prevBlock.source.filePath !== nextBlock.source.filePath
      ) {
        return false
      }
      continue
    }
    return false
  }
  return true
}

export function areToolCallCardPropsEqual(prev: ToolCallCardProps, next: ToolCallCardProps): boolean {
  return (
    prev.toolUseId === next.toolUseId &&
    prev.name === next.name &&
    prev.status === next.status &&
    prev.error === next.error &&
    prev.startedAt === next.startedAt &&
    prev.completedAt === next.completedAt &&
    prev.forceOpen === next.forceOpen &&
    shallowEqualRecord(prev.input, next.input) &&
    toolResultContentEqual(prev.output, next.output)
  )
}

// ── Output helpers ──

export function outputAsString(output: ToolResultContent | undefined): string | undefined {
  if (output === undefined) return undefined
  if (typeof output === 'string') return output
  const texts = output
    .filter((b) => b.type === 'text')
    .map((b) => (b.type === 'text' ? b.text : ''))
  return texts.join('\n') || undefined
}

export function hasImageBlocks(output: ToolResultContent | undefined): boolean {
  return Array.isArray(output) && output.some((b) => b.type === 'image')
}

export function getImageBlockPreviewSrc(image: ImageBlock): string {
  if (image.source.type === 'base64' && image.source.data) {
    return `data:${image.source.mediaType || 'image/png'};base64,${image.source.data}`
  }
  return image.source.url ?? ''
}

// ── Error detection ──

export function deriveOutputError(output: string | undefined): string | null {
  if (!output) return null
  const trimmed = output.trim()
  if (!trimmed) return null

  const parsed = decodeStructuredToolResult(trimmed)
  if (parsed) {
    if (!Array.isArray(parsed) && typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error.trim()
    }
    return null
  }

  return trimmed
}

export function isErrorOnlyOutput(output: string | undefined): boolean {
  if (!output) return false
  const trimmed = output.trim()
  if (!trimmed) return false

  const parsed = decodeStructuredToolResult(trimmed)
  if (!parsed) return true
  if (Array.isArray(parsed)) return false

  return (
    Object.keys(parsed).length === 1 &&
    typeof parsed.error === 'string' &&
    parsed.error.trim().length > 0
  )
}

export function isStructuredBashResult(output: string | undefined): boolean {
  if (!output) return false
  const parsed = decodeStructuredToolResult(output.trim())
  if (!parsed || Array.isArray(parsed)) return false
  return (
    'stdout' in parsed ||
    'stderr' in parsed ||
    'output' in parsed ||
    'exitCode' in parsed ||
    'processId' in parsed
  )
}

// ── Path / string helpers ──

export function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function getStringInput(input: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export function firstStringInput(input: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = input[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

export function compactPath(value: string, depth = 2): string {
  const parts = value.split(/[\\/]/).filter(Boolean)
  if (parts.length === 0) return value
  return parts.slice(-depth).join('/')
}

export function pathFileName(value: string): string {
  return compactPath(value, 1)
}

export function pathParent(value: string, depth = 3): string {
  const parts = value.split(/[\\/]/).filter(Boolean)
  if (parts.length <= 1) return ''
  return parts.slice(Math.max(0, parts.length - depth - 1), -1).join('/')
}

export function compactToolPathSummary(value: string): {
  primary: string
  secondary?: string
} {
  return {
    primary: pathFileName(value),
    secondary: value ? pathParent(value) || compactPath(value, 2) : undefined
  }
}

export function fileToolPath(input: Record<string, unknown>): string {
  return firstStringInput(input, [
    'file_path',
    'path',
    'notebook_path',
    'notebook',
    'targetPath',
    'target_path'
  ])
}

export function getSkillNameFromInput(input: Record<string, unknown>): string {
  const raw = input.SkillName ?? input.skillName ?? input.name
  return typeof raw === 'string' ? raw.trim() : ''
}

// ── Read helpers ──

export function stripReadLineNumbers(output: string): string {
  return /^\s*\d+\t/.test(output)
    ? output
        .split('\n')
        .map((line) => line.replace(/^\s*\d+\t/, ''))
        .join('\n')
    : output
}

export function getReadOutputLineCount(output: string | undefined): number | null {
  if (!output?.trim()) return null
  const decoded = decodeStructuredToolResult(output)
  if (decoded && !Array.isArray(decoded) && typeof decoded.error === 'string') return null
  return stripReadLineNumbers(output).split('\n').length
}

// ── Line / lang helpers ──

export function lineCount(text: string): number {
  return text.length === 0 ? 0 : text.split('\n').length
}

export function detectLang(filePath: string): string {
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

// ── Shell helpers ──

export function normalizeLiveShellChunk(chunk: string): string {
  return chunk.replace(ANSI_ESCAPE_RE, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function clampLiveShellText(text: string): string {
  if (text.length <= LIVE_SHELL_OUTPUT_MAX_CHARS) return text
  return text.slice(-LIVE_SHELL_OUTPUT_MAX_CHARS)
}

export function appendLiveShellOutput(
  state: LiveShellOutputState,
  execId: string,
  chunk: string
): LiveShellOutputState {
  const base =
    state.execId === execId
      ? state
      : {
          execId,
          text: ''
        }
  const text = normalizeLiveShellChunk(chunk)
  if (!text) return base
  return {
    ...base,
    text: clampLiveShellText(`${base.text}${text}`)
  }
}

export function getShellInputCommand(input: Record<string, unknown>, fallback?: string): string {
  if (typeof fallback === 'string' && fallback.trim()) return fallback
  return (
    getStringInput(input, ['command', 'command_preview']) ||
    (typeof fallback === 'string' ? fallback : '')
  )
}

export function getShellCwd(input: Record<string, unknown>, fallback?: string): string {
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim()
  return (
    getStringInput(input, ['cwd', 'workingDirectory', 'working_dir', 'workingFolder']) ||
    (typeof fallback === 'string' && fallback.trim() ? fallback.trim() : '~')
  )
}

export function buildShellPromptLine(toolName: string, cwd: string, command: string): string {
  const normalizedCommand = normalizeLiveShellChunk(command).trimEnd()
  const isPowerShell = toolName === 'PowerShell'
  const prefix = isPowerShell ? `PS ${cwd}>` : `${cwd} $`
  if (!normalizedCommand) return prefix

  const lines = normalizedCommand.split('\n')
  const continuation = isPowerShell ? '>>' : '>'
  return [`${prefix} ${lines[0]}`, ...lines.slice(1).map((line) => `${continuation} ${line}`)].join(
    '\n'
  )
}

export function getBashInputTerminalId(input: Record<string, unknown>): string | null {
  const terminalId = input.terminalId
  return typeof terminalId === 'string' && terminalId.trim() ? terminalId.trim() : null
}

function getStringField(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key]
  return typeof field === 'string' ? field : undefined
}

function getNumberField(value: Record<string, unknown>, key: string): number | undefined {
  const field = value[key]
  return typeof field === 'number' ? field : undefined
}

export function normalizeShellResult(value: unknown): ParsedShellResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const source =
    record.result && typeof record.result === 'object' && !Array.isArray(record.result)
      ? (record.result as Record<string, unknown>)
      : record
  if (
    !('stdout' in source) &&
    !('stderr' in source) &&
    !('output' in source) &&
    !('exitCode' in source) &&
    !('processId' in source)
  ) {
    return null
  }

  return {
    stdout: getStringField(source, 'stdout'),
    stderr: getStringField(source, 'stderr'),
    output: getStringField(source, 'output'),
    exitCode: getNumberField(source, 'exitCode'),
    processId: getStringField(source, 'processId'),
    terminalId: getStringField(source, 'terminalId'),
    summary:
      source.summary && typeof source.summary === 'object' && !Array.isArray(source.summary)
        ? (source.summary as ShellOutputSummary)
        : undefined,
    cwd: getStringField(source, 'cwd'),
    command: getStringField(source, 'command'),
    timedOut: typeof source.timedOut === 'boolean' ? source.timedOut : undefined,
    totalMs: getNumberField(source, 'totalMs')
  }
}

export function buildStoredShellOutput(parsed: ParsedShellResult | null): string {
  if (!parsed) return ''
  if (parsed.output) return parsed.output
  return [parsed.stderr, parsed.stdout ?? parsed.output]
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
    .join('\n')
}

export function bashOutputStats(outputText: string | undefined): {
  lines: number | null
  exitCode: number | null
} {
  if (!outputText?.trim()) return { lines: null, exitCode: null }
  const decoded = decodeStructuredToolResult(outputText)
  if (decoded && !Array.isArray(decoded)) {
    const stdout =
      typeof decoded.stdout === 'string'
        ? decoded.stdout
        : typeof decoded.output === 'string'
          ? decoded.output
          : ''
    const stderr = typeof decoded.stderr === 'string' ? decoded.stderr : ''
    const text = [stderr, stdout].filter(Boolean).join('\n\n')
    return {
      lines: text ? lineCount(text) : null,
      exitCode: typeof decoded.exitCode === 'number' ? decoded.exitCode : null
    }
  }
  return { lines: lineCount(outputText), exitCode: null }
}

// ── Search helpers ──

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeSearchMeta(decoded: unknown): SearchOutputMeta {
  if (!isRecord(decoded)) {
    return { truncated: false, timedOut: false, warnings: [] }
  }
  const rawMeta = isRecord(decoded.meta) ? decoded.meta : null
  const rawEngine = decoded.engine ?? rawMeta?.engine
  return {
    engine: typeof rawEngine === 'string' ? rawEngine : undefined,
    truncated: decoded.truncated === true,
    timedOut: decoded.timedOut === true,
    limitReason: typeof decoded.limitReason === 'string' ? decoded.limitReason : null,
    warnings: Array.isArray(decoded.warnings)
      ? decoded.warnings.filter(
          (item): item is string => typeof item === 'string' && item.length > 0
        )
      : [],
    error: typeof decoded.error === 'string' ? decoded.error : undefined
  }
}

export function formatSearchEngineLabel(engine: string | undefined): string | null {
  if (!engine) return null
  if (engine === 'git_grep') return 'git grep'
  if (engine === 'ripgrep') return 'ripgrep'
  if (engine === 'native_aot') return '.NET native'
  if (engine === 'node' || engine.startsWith('node_')) return 'legacy local search'
  if (engine === 'remote_rg') return 'remote rg'
  if (engine === 'remote_grep') return 'remote grep'
  return engine
}

export function parseLegacyGrepMatch(value: unknown): ParsedGrepEntry | null {
  if (typeof value !== 'string') return null
  const match = value.match(/^(.+?)([:-])(\d+)\2(?:(\d+)\2)?(.*)$/)
  if (!match) return null
  return {
    file: match[1],
    line: Number(match[3]),
    column: match[4] ? Number(match[4]) : undefined,
    text: match[5] ?? '',
    kind: match[2] === '-' ? 'context' : 'match'
  }
}

export function parseGrepTextMatches(text: string): ParsedGrepEntry[] {
  return text
    .split(/\r?\n/)
    .map((line) => parseLegacyGrepMatch(line))
    .filter((item): item is ParsedGrepEntry => !!item)
}

export function getSearchVisualState(meta: SearchOutputMeta, matchCount: number): SearchVisualState {
  if (meta.error) return 'error'
  if (meta.truncated || meta.timedOut || meta.warnings.length > 0) return 'warning'
  if (matchCount > 0) return 'found'
  return 'empty'
}

export function parseGrepOutput(output: string): {
  matches: ParsedGrepEntry[]
  meta: SearchOutputMeta
  output?: string
} | null {
  const decoded = decodeStructuredToolResult(output)
  if (!decoded) {
    const matches = parseGrepTextMatches(output)
    if (matches.length === 0 && output.trim().length === 0) return null
    return {
      matches,
      meta: { truncated: false, timedOut: false, warnings: [] },
      output
    }
  }

  if (Array.isArray(decoded)) {
    return {
      matches: decoded
        .map((item) => {
          const legacyMatch = parseLegacyGrepMatch(item)
          if (legacyMatch) return legacyMatch
          if (!isRecord(item)) return null
          const file =
            typeof item.file === 'string'
              ? item.file
              : typeof item.path === 'string'
                ? item.path
                : null
          const line = typeof item.line === 'number' ? item.line : null
          const column = typeof item.column === 'number' ? item.column : undefined
          const text = typeof item.text === 'string' ? item.text : ''
          const count = typeof item.count === 'number' ? item.count : undefined
          if (!file) return null
          if (line == null && count === undefined) return { file, text }
          return { file, line: line ?? undefined, column, text, count }
        })
        .filter((item): item is ParsedGrepEntry => !!item),
      meta: { truncated: false, timedOut: false, warnings: [] }
    }
  }

  if (!isRecord(decoded)) return null
  const rawOutput = typeof decoded.output === 'string' ? decoded.output : undefined
  const matchesSource = Array.isArray(decoded.matches)
    ? decoded.matches
    : Array.isArray(decoded.results)
      ? decoded.results
      : []

  const parsedMatches = matchesSource
    .map((item) => {
      const legacyMatch = parseLegacyGrepMatch(item)
      if (legacyMatch) return legacyMatch
      if (!isRecord(item)) return null
      const file =
        typeof item.file === 'string' ? item.file : typeof item.path === 'string' ? item.path : null
      const line = typeof item.line === 'number' ? item.line : null
      const column = typeof item.column === 'number' ? item.column : undefined
      const text = typeof item.text === 'string' ? item.text : ''
      const count = typeof item.count === 'number' ? item.count : undefined
      if (!file) return null
      if (line == null && count === undefined) {
        return {
          file,
          text,
          kind: item.kind === 'context' ? 'context' : 'match'
        }
      }
      return {
        file,
        line: line ?? undefined,
        column,
        text,
        count,
        kind: item.kind === 'context' ? 'context' : 'match'
      }
    })
    .filter((item): item is ParsedGrepEntry => !!item)
  const outputMatches =
    parsedMatches.length === 0 && rawOutput ? parseGrepTextMatches(rawOutput) : []

  return {
    matches: parsedMatches.length > 0 ? parsedMatches : outputMatches,
    meta: normalizeSearchMeta(decoded),
    output: rawOutput
  }
}

export function parseGlobOutput(output: string): { matches: string[]; meta: SearchOutputMeta } | null {
  const decoded = decodeStructuredToolResult(output)
  if (!decoded) return null

  if (Array.isArray(decoded)) {
    return {
      matches: decoded.filter((item): item is string => typeof item === 'string'),
      meta: { truncated: false, timedOut: false, warnings: [] }
    }
  }

  if (!isRecord(decoded)) return null
  const matchesSource = Array.isArray(decoded.matches)
    ? decoded.matches
    : Array.isArray(decoded.results)
      ? decoded.results
      : []

  return {
    matches: matchesSource
      .map((item) => {
        if (typeof item === 'string') return item
        if (isRecord(item) && typeof item.path === 'string') return item.path
        return null
      })
      .filter((item): item is string => !!item),
    meta: normalizeSearchMeta(decoded)
  }
}

export function parseLsEntries(output: string | undefined): LsEntry[] | null {
  if (!output?.trim()) return null
  const decoded = decodeStructuredToolResult(output)
  if (!Array.isArray(decoded)) return null
  return decoded
    .map((entry): LsEntry | null => {
      if (!isRecord(entry) || typeof entry.name !== 'string' || typeof entry.type !== 'string') {
        return null
      }
      return {
        name: entry.name,
        type: entry.type,
        path: typeof entry.path === 'string' ? entry.path : undefined
      }
    })
    .filter((entry): entry is LsEntry => !!entry)
}

// ── Structured input formatting ──

export function formatPrimitiveInputValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.length > 80 ? `${value.slice(0, 80)}...` : value
  }
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    value === null
  ) {
    return String(value)
  }
  return value === undefined ? 'undefined' : typeof value
}

export function formatStructuredInputValue(value: unknown): { text: string; mono: boolean } {
  if (typeof value === 'string') {
    const text =
      value.length > 300
        ? `${value.slice(0, 300)}... (${value.length} chars)`
        : value
    return { text, mono: false }
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    value === null
  ) {
    return { text: String(value), mono: true }
  }

  if (Array.isArray(value)) {
    const preview = value.slice(0, 6).map(formatPrimitiveInputValue)
    const suffix = value.length > 6 ? ', ...' : ''
    return {
      text: preview.length > 0 ? `[${preview.join(', ')}${suffix}] (${value.length} items)` : '[]',
      mono: true
    }
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>)
    const visibleKeys = keys.slice(0, 12)
    const suffix = keys.length > 12 ? ', ...' : ''
    return {
      text:
        visibleKeys.length > 0
          ? `{ ${visibleKeys.join(', ')}${suffix} } (${keys.length} keys)`
          : '{}',
      mono: true
    }
  }

  return { text: String(value), mono: true }
}

// ── Widget helpers ──

export function normalizeWidgetPayload(input: Record<string, unknown>): WidgetToolPayload | null {
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const rawCode =
    typeof input.widget_code === 'string'
      ? input.widget_code
      : typeof input.widget_code_preview === 'string'
        ? input.widget_code_preview
        : ''
  const widgetCode = rawCode.trimStart()
  const loadingMessages = Array.isArray(input.loading_messages)
    ? input.loading_messages
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : []
  const explicitKind =
    input.widget_kind === 'svg' || input.widget_kind === 'html' ? input.widget_kind : null

  if (!title && !widgetCode.trim()) return null

  return {
    title: title || 'widget',
    loadingMessages,
    widgetCode,
    kind: explicitKind ?? (/^<svg[\s>]/i.test(widgetCode) ? 'svg' : 'html')
  }
}

export function buildWidgetDocument(payload: WidgetToolPayload): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent !important;
      }
      html {
        color-scheme: dark;
      }
      body {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #e5e7eb;
        overflow: hidden;
      }
      #open-cowork-widget-root {
        width: 100%;
        background: transparent !important;
      }
      ${payload.kind === 'svg' ? '#open-cowork-widget-root { display: block; overflow: hidden; line-height: 0; font-size: 0; } #open-cowork-widget-root > svg { display: block; width: 100%; height: auto; margin: 0; background: transparent !important; overflow: hidden; }' : ''}
    </style>
    <script>
      (() => {
        const bridgeSource = ${JSON.stringify(WIDGET_BRIDGE_SOURCE)};
        const post = (type, extra = {}) => {
          window.parent.postMessage({ source: bridgeSource, type, ...extra }, '*');
        };
        const getBoundingHeight = (element) => {
          if (!element) return 0;
          return element.getBoundingClientRect?.().height || 0;
        };
        const getContentHeight = (element) => {
          if (!element) return 0;
          return Math.max(
            getBoundingHeight(element),
            element.scrollHeight || 0,
            element.offsetHeight || 0
          );
        };
        const reportSize = () => {
          const root = document.getElementById('open-cowork-widget-root');
          const content = root?.firstElementChild;
          const nextHeight =
            getBoundingHeight(content) ||
            getBoundingHeight(root) ||
            getContentHeight(root) ||
            getBoundingHeight(document.body) ||
            getContentHeight(document.body);
          post('resize', { height: Math.max(nextHeight, 32) });
        };
        let lastAppliedCode = '';

        const executeInsertedScripts = (root) => {
          const scripts = Array.from(root.querySelectorAll('script'));
          for (const script of scripts) {
            const next = document.createElement('script');
            for (const attr of Array.from(script.attributes)) {
              next.setAttribute(attr.name, attr.value);
            }
            next.text = script.textContent || '';
            script.replaceWith(next);
          }
        };

        const applyWidgetCode = (code) => {
          if (typeof code !== 'string' || code === lastAppliedCode) return;
          lastAppliedCode = code;
          const root = document.getElementById('open-cowork-widget-root');
          if (!root) return;
          root.innerHTML = code;
          executeInsertedScripts(root);
          reportSize();
          window.requestAnimationFrame(reportSize);
          setTimeout(reportSize, 80);
          setTimeout(reportSize, 240);
        };

        window.sendPrompt = (text) => {
          if (typeof text !== 'string') return;
          const trimmed = text.trim();
          if (!trimmed) return;
          post('send_prompt', { text: trimmed });
        };

        window.addEventListener('message', (event) => {
          const data = event.data;
          if (!data || typeof data !== 'object') return;
          if (data.source !== bridgeSource || data.type !== 'update_code') return;
          applyWidgetCode(data.code);
        });

        window.__openCoworkWidgetReady = () => {
          const root = document.getElementById('open-cowork-widget-root');
          if (typeof ResizeObserver !== 'undefined' && root) {
            const observer = new ResizeObserver(() => reportSize());
            observer.observe(root);
          }
          post('ready');
          reportSize();
          window.requestAnimationFrame(reportSize);
          setTimeout(reportSize, 120);
          setTimeout(reportSize, 360);
        };
      })();
    </script>
  </head>
  <body>
    <div id="open-cowork-widget-root"></div>
    <script>window.__openCoworkWidgetReady && window.__openCoworkWidgetReady();</script>
  </body>
</html>`
}
