import { useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'

interface UseFileWatcherOptions {
  readContent?: boolean
}

interface UseFileWatcherResult {
  content: string
  setContent: Dispatch<SetStateAction<string>>
  loading: boolean
  reload: () => Promise<void>
  version: number
}

function getReadError(result: unknown): string | null {
  if (result && typeof result === 'object' && 'error' in result) {
    const error = (result as { error?: unknown }).error
    return typeof error === 'string' && error.length > 0 ? error : 'Failed to read file'
  }

  if (typeof result !== 'string' || !result.trim().startsWith('{')) return null

  try {
    const parsed = JSON.parse(result) as { error?: unknown }
    return typeof parsed.error === 'string' && parsed.error.length > 0 ? parsed.error : null
  } catch {
    return null
  }
}

function getChangedPath(args: unknown[]): string | null {
  const payload = args[0]
  if (!payload || typeof payload !== 'object' || !('path' in payload)) return null

  const path = (payload as { path?: unknown }).path
  return typeof path === 'string' && path.length > 0 ? path : null
}

function normalizeWatchPath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '')
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized
}

function getResolvedWatchPath(result: unknown): string | null {
  if (!result || typeof result !== 'object' || !('path' in result)) return null

  const path = (result as { path?: unknown }).path
  return typeof path === 'string' && path.length > 0 ? path : null
}

export function useFileWatcher(
  filePath: string | null,
  sshConnectionId?: string,
  options: UseFileWatcherOptions = {}
): UseFileWatcherResult {
  const readContent = options.readContent ?? true
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState(0)
  const requestIdRef = useRef(0)
  const watchedPathRef = useRef<string | null>(null)

  const loadContent = useCallback(async () => {
    const requestId = ++requestIdRef.current
    if (!filePath) {
      setContent('')
      setLoading(false)
      return
    }
    if (!readContent) {
      setContent('')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const channel = sshConnectionId ? IPC.SSH_FS_READ_FILE : IPC.FS_READ_FILE
      const args = sshConnectionId
        ? { connectionId: sshConnectionId, path: filePath }
        : { path: filePath }
      const result = await ipcClient.invoke(channel, args)
      const readError = getReadError(result)
      if (readError) {
        throw new Error(readError)
      }
      if (requestId === requestIdRef.current) setContent(String(result))
    } catch (err) {
      console.error('[useFileWatcher] Failed to read file:', err)
      if (requestId === requestIdRef.current) setContent('')
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [filePath, readContent, sshConnectionId])

  const reload = useCallback(async () => {
    setVersion((current) => current + 1)
    await loadContent()
  }, [loadContent])

  // Initial load
  useEffect(() => {
    loadContent()
  }, [loadContent])

  // Watch for changes
  useEffect(() => {
    if (!filePath || sshConnectionId) return

    let disposed = false
    const requestedWatchPath = normalizeWatchPath(filePath)
    watchedPathRef.current = requestedWatchPath

    ipcClient
      .invoke(IPC.FS_WATCH_FILE, { path: filePath })
      .then((result) => {
        if (disposed) return
        const resolvedWatchPath = getResolvedWatchPath(result)
        watchedPathRef.current = resolvedWatchPath
          ? normalizeWatchPath(resolvedWatchPath)
          : requestedWatchPath
      })
      .catch(() => {})

    const handler = (...args: unknown[]): void => {
      const changedPath = getChangedPath(args)
      const watchedPath = watchedPathRef.current ?? requestedWatchPath
      if (!changedPath || normalizeWatchPath(changedPath) !== watchedPath) return

      setVersion((current) => current + 1)
      if (readContent) void loadContent()
    }
    const cleanup = ipcClient.on(IPC.FS_FILE_CHANGED, handler)

    return () => {
      disposed = true
      cleanup()
      ipcClient.invoke(IPC.FS_UNWATCH_FILE, { path: filePath }).catch(() => {})
    }
  }, [filePath, loadContent, readContent, sshConnectionId])

  return { content, setContent, loading, reload, version }
}
