/**
 * Renderer-side error logger.
 *
 * Captures all unhandled errors and promise rejections in the renderer process
 * and forwards them to the main process via IPC, which writes them to log files.
 *
 * Also patches console.error to forward error-level console output.
 */

let installed = false

export function installRendererErrorLogger(): void {
  if (installed) return
  installed = true

  // Capture uncaught errors
  window.addEventListener('error', (event) => {
    const stack = event.error instanceof Error ? event.error.stack : undefined
    void writeLog('error', event.message || 'Uncaught error', stack, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    })
  })

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = reason instanceof Error ? reason.message : String(reason)
    const stack = reason instanceof Error ? reason.stack : undefined
    void writeLog('error', 'Unhandled Promise Rejection: ' + message, stack)
  })

  // Patch console.error to also write to log file
  const originalConsoleError = console.error
  console.error = (...args: unknown[]): void => {
    // Call original first
    originalConsoleError.apply(console, args)

    // Forward to log file (fire and forget)
    const message = args
      .map((arg) => {
        if (arg instanceof Error) return arg.message + (arg.stack ? '\n' + arg.stack : '')
        if (typeof arg === 'string') return arg
        try {
          return JSON.stringify(arg)
        } catch {
          return String(arg)
        }
      })
      .join(' ')

    if (message.trim()) {
      void writeLog('error', message)
    }
  }
}

async function writeLog(
  level: string,
  message: string,
  stack?: string,
  extra?: Record<string, unknown>
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).api
    if (api?.log) {
      await api.log({ level, message, stack, extra })
    }
  } catch {
    // Logging must never throw
  }
}
