// electron app import removed — logs now go to ~/.wishful-claw/logs/
import { join } from 'path'
import * as os from 'os'
import * as fs from 'fs'

// ─── Types ───

export type LogLevel = 'error' | 'warn' | 'info'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  source: 'main' | 'renderer' | 'worker' | 'ipc'
  message: string
  stack?: string
  extra?: Record<string, unknown>
}

// ─── Log file management ───

let logDir: string = ''

function getLogDir(): string {
  if (!logDir) {
    logDir = join(os.homedir(), '.wishful-claw', 'logs')
  }
  return logDir
}

function getLogFilePath(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return join(getLogDir(), `${y}-${m}-${d}.log`)
}

function ensureLogDir(): void {
  const dir = getLogDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// ─── Write ───

function formatEntry(entry: LogEntry): string {
  const parts: string[] = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
    `[${entry.source}]`,
    entry.message
  ]
  if (entry.stack) {
    parts.push('\n' + entry.stack)
  }
  if (entry.extra && Object.keys(entry.extra).length > 0) {
    try {
      parts.push('\n  extra: ' + JSON.stringify(entry.extra, null, 2))
    } catch {
      parts.push('\n  extra: [unserializable]')
    }
  }
  return parts.join(' ') + '\n'
}

function writeLog(entry: LogEntry): void {
  try {
    ensureLogDir()
    const text = formatEntry(entry)
    fs.appendFileSync(getLogFilePath(), text, 'utf-8')
  } catch {
    // Last resort: if even logging fails, swallow silently
  }
}

// ─── Public API ───

export function logError(
  source: LogEntry['source'],
  message: string,
  options?: { stack?: string; extra?: Record<string, unknown> }
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    level: 'error',
    source,
    message,
    stack: options?.stack,
    extra: options?.extra
  })
}

export function logWarn(
  source: LogEntry['source'],
  message: string,
  options?: { stack?: string; extra?: Record<string, unknown> }
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    level: 'warn',
    source,
    message,
    stack: options?.stack,
    extra: options?.extra
  })
}

export function logInfo(
  source: LogEntry['source'],
  message: string,
  options?: { extra?: Record<string, unknown> }
): void {
  writeLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    source,
    message,
    extra: options?.extra
  })
}

/**
 * Extract a stack trace from an unknown error value.
 */
export function extractStack(err: unknown): string | undefined {
  if (err instanceof Error) {
    return err.stack || err.message
  }
  if (typeof err === 'string') {
    return err
  }
  if (err && typeof err === 'object' && 'stack' in err) {
    return String((err as { stack: unknown }).stack)
  }
  return undefined
}

export function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

// ─── Global exception handlers ───

let handlersInstalled = false

export function installGlobalExceptionHandlers(): void {
  if (handlersInstalled) return
  handlersInstalled = true

  process.on('uncaughtException', (err: Error) => {
    logError('main', 'Uncaught Exception: ' + err.message, {
      stack: err.stack,
      extra: { name: err.name }
    })
  })

  process.on('unhandledRejection', (reason: unknown) => {
    logError('main', 'Unhandled Promise Rejection: ' + extractMessage(reason), {
      stack: extractStack(reason)
    })
  })
}

// ─── Log read API (for the UI to read recent logs) ───

export function readRecentLogs(maxLines = 500): string {
  try {
    const filePath = getLogFilePath()
    if (!fs.existsSync(filePath)) return ''
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    return lines.slice(-maxLines).join('\n')
  } catch {
    return ''
  }
}

export function getLogDirectory(): string {
  return getLogDir()
}
