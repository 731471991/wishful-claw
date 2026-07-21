import { BrowserWindow } from 'electron'
import { getNativeWorker } from '../lib/native-worker'
import { safeSendMessagePackToWindow } from '../window-ipc'

/**
 * Registers a listener on the native worker for 'agent/stream' events
 * and forwards them to all renderer windows as MessagePack-encoded payloads.
 */
export function registerAgentStreamForwarder(): void {
  const worker = getNativeWorker()

  worker.onEvent('agent/stream', (payload: unknown) => {
    for (const win of BrowserWindow.getAllWindows()) {
      safeSendMessagePackToWindow(win, 'agent/stream', payload)
    }
  })
}
