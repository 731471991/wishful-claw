import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  decodeMessagePackPayload,
  encodeMessagePackPayload,
  toMessagePackChannel
} from '../../shared/messagepack/binary-ipc'

export function registerMessagePackHandler<TArgs, TResult = unknown>(
  channel: string,
  handler: (args: TArgs, event: IpcMainInvokeEvent) => Promise<TResult> | TResult
): void {
  ipcMain.handle(toMessagePackChannel(channel), async (event, bytes: Uint8Array) => {
    try {
      const args = decodeMessagePackPayload<TArgs>(bytes)
      return encodeMessagePackPayload(await handler(args, event))
    } catch (err) {
      console.error(`[IPC] Handler error for '${channel}':`, err instanceof Error ? err.message : String(err))
      return encodeMessagePackPayload({ error: err instanceof Error ? err.message : String(err) })
    }
  })
}
