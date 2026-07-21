import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ping: () => Promise<{ ok: boolean; pid: number }>
      invoke: <T = unknown>(channel: string, payload: unknown) => Promise<T>
      workerRequest: <T = unknown>(method: string, params?: unknown) => Promise<T>
      on: <T = unknown>(channel: string, callback: (payload: T) => void) => () => void
    }
  }
}
