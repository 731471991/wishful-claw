/**
 * Webview helpers stub.
 * Placeholder for the full webview-helpers module that will be migrated later.
 */

export type MaybePromise<T> = T | Promise<T>

/**
 * Checks whether a value is a thenable (Promise-like).
 */
export function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

/**
 * Checks whether a webview element is connected to the DOM.
 */
export function isWebviewConnected(webview: unknown): webview is Electron.WebviewTag {
  return (
    !!webview &&
    typeof webview === 'object' &&
    webview !== null &&
    'isConnected' in webview &&
    (webview as { isConnected: boolean }).isConnected
  )
}

/**
 * Describes a webview operation error in a user-friendly way.
 */
export function describeWebviewOperationError(action: string, error: unknown): string {
  if (error instanceof Error) {
    return `Failed to ${action}: ${error.message}`
  }
  return `Failed to ${action}: ${String(error)}`
}
