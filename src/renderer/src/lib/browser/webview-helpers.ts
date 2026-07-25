export type MaybePromise<T> = T | PromiseLike<T>

export function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as PromiseLike<T>).then === 'function'
  )
}

export function isWebviewConnected(
  webview: Electron.WebviewTag | null | undefined
): webview is Electron.WebviewTag {
  return Boolean(webview?.isConnected)
}

export function isGuestViewManagerReplyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('GUEST_VIEW_MANAGER_CALL') && message.includes('reply was never sent')
}

export function describeWebviewOperationError(action: string, error: unknown): string {
  if (isGuestViewManagerReplyError(error)) {
    return `Browser view was detached while trying to ${action}. Reopen the browser tab and try again.`
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return String(error)
}
