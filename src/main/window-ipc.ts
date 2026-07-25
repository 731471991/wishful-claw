import { BrowserWindow } from 'electron'
import { encodeMessagePackPayload, toMessagePackChannel } from '../shared/messagepack/binary-ipc'

/**
 * Send a MessagePack-encoded event to a specific BrowserWindow's renderer.
 * Used for main → renderer push events (e.g. window:maximized state changes).
 */
export function safeSendMessagePackToWindow(
  win: BrowserWindow,
  channel: string,
  payload: unknown
): boolean {
  if (win.isDestroyed()) return false

  const contents = win.webContents
  if (!contents || contents.isDestroyed()) return false

  const bytes = encodeMessagePackPayload(payload)
  const binaryChannel = toMessagePackChannel(channel)

  try {
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    contents.postMessage(binaryChannel, arrayBuffer)
    return true
  } catch {
    // fall through to send() fallback
  }

  try {
    contents.send(binaryChannel, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
    return true
  } catch {
    return false
  }
}

/**
 * Send a MessagePack-encoded event to ALL BrowserWindow instances.
 * Used for broadcast events like plugin:incoming-message, plugin:session-task.
 */
export function safeSendMessagePackToAllWindows(
  channel: string,
  payload: unknown
): void {
  for (const win of BrowserWindow.getAllWindows()) {
    safeSendMessagePackToWindow(win, channel, payload)
  }
}
