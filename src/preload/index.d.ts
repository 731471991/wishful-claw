import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ping: () => Promise<{ ok: boolean; pid: number }>
    }
  }
}
