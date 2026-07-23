import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import {
  decodeMessagePackPayload,
  encodeMessagePackPayload,
  toMessagePackChannel
} from '../../shared/messagepack/binary-ipc'
import { logError, extractStack, extractMessage } from '../lib/logger'

export function registerMessagePackHandler<TArgs, TResult = unknown>(
  channel: string,
  handler: (args: TArgs, event: IpcMainInvokeEvent) => Promise<TResult> | TResult
): void {
  ipcMain.handle(toMessagePackChannel(channel), async (event, bytes: Uint8Array) => {
    try {
      const args = decodeMessagePackPayload<TArgs>(bytes)
      return encodeMessagePackPayload(await handler(args, event))
    } catch (err) {
      const msg = extractMessage(err)
      const stack = extractStack(err)
      console.error(`[IPC] Handler error for '${channel}':`, msg)
      logError('ipc', `Handler error for '${channel}': ${msg}`, { stack, extra: { channel } })
      return encodeMessagePackPayload({ error: msg })
    }
  })
}
