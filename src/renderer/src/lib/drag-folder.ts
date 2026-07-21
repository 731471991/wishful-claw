import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'

interface StatPathResult {
  exists?: boolean
  type?: 'file' | 'directory' | 'other' | null
  error?: string
}

/**
 * Resolve absolute local paths from a drag-and-drop DataTransfer.
 *
 * Electron 36 removed the legacy `File.path` property, so we rely on the
 * preload-exposed `webUtils.getPathForFile`. Virtual files dragged from
 * sources without an on-disk path (e.g. a browser) yield an empty string and
 * are filtered out.
 */
export function getDroppedLocalPaths(dataTransfer: DataTransfer | null | undefined): string[] {
  const getPathForFile = window.electron?.webUtils?.getPathForFile
  if (!dataTransfer || typeof getPathForFile !== 'function') return []

  const paths: string[] = []
  for (const file of Array.from(dataTransfer.files)) {
    const resolved = getPathForFile(file)
    if (resolved) paths.push(resolved)
  }
  return paths
}

/** Keep only the paths that point to a directory on disk. */
export async function filterDirectories(paths: string[]): Promise<string[]> {
  const checks = await Promise.all(
    paths.map(async (path) => {
      try {
        const result = (await ipcClient.invoke(IPC.FS_STAT_PATH, { path })) as StatPathResult
        return result?.exists === true && result.type === 'directory' ? path : null
      } catch {
        return null
      }
    })
  )
  return checks.filter((path): path is string => path !== null)
}
