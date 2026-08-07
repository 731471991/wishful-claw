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

  // Guard against a disposed render frame. During navigation / reload the
  // webContents can still be alive while its mainFrame is already torn down.
  if (!contents.mainFrame || contents.mainFrame.isDestroyed()) return false

  const bytes = encodeMessagePackPayload(payload)
  const binaryChannel = toMessagePackChannel(channel)
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

  // IMPORTANT: only use webContents.postMessage here. Unlike webContents.send(),
  // postMessage() does not access WebFrameMain, so it will never throw the
  // "Render frame was disposed before WebFrameMain could be accessed" error
  // (Electron 35+). That error is raised asynchronously by Electron internals
  // and CANNOT be caught by try/catch, so any send() fallback here would spam
  // the console on every navigation / reload race.
  try {
    contents.postMessage(binaryChannel, arrayBuffer)
    return true
  } catch {
    // Frame may be mid-teardown; drop the event rather than risk an
    // uncatchable async throw. The renderer re-syncs on next load.
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
