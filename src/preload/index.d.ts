import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ping: () => Promise<{ ok: boolean; pid: number }>
      invoke: <T = unknown>(channel: string, payload: unknown) => Promise<T>
      workerRequest: <T = unknown>(method: string, params?: unknown) => Promise<T>
      on: <T = unknown>(channel: string, callback: (payload: T) => void) => () => void
      onAgentStream: (callback: (payload: unknown) => void) => () => void
      /** Open a native folder selection dialog. Returns { folderPath, canceled }. */
      openFolderDialog: () => Promise<{ folderPath: string | null; canceled: boolean }>
      /** Write a log entry to the log file (forwarded to main process). */
      log: (payload: { level: string; message: string; stack?: string; extra?: Record<string, unknown> }) => Promise<void>
      /** Read recent log lines from today's log file. */
      readLogs: (maxLines?: number) => Promise<string>
    }
  }
}

export {}
