import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  decodeMessagePackPayload,
  encodeMessagePackPayload,
  toMessagePackChannel
} from '../shared/messagepack/binary-ipc'

async function invokeMessagePackBinary<T>(channel: string, payload: unknown): Promise<T> {
  const response = await ipcRenderer.invoke(
    toMessagePackChannel(channel),
    encodeMessagePackPayload(payload)
  )
  return decodeMessagePackPayload<T>(response as ArrayBuffer | ArrayBufferView)
}

const api = {
  ping: () => invokeMessagePackBinary<{ ok: boolean; pid: number }>('worker/ping', {}),

  // Generic IPC invoke — used by IPC state storage for provider persistence
  invoke: <T = unknown>(channel: string, payload: unknown): Promise<T> =>
    invokeMessagePackBinary<T>(channel, payload),

  // Worker provider CRUD — routed through main process to worker
  workerRequest: <T = unknown>(method: string, params?: unknown): Promise<T> =>
    invokeMessagePackBinary<T>(`worker:${method}`, params ?? {})
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
