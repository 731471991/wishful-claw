import type { BrowserWindow } from 'electron'

/**
 * Central registry for the main BrowserWindow reference.
 *
 * Other modules (e.g. native-agent-runtime) need to send IPC messages to the
 * main renderer window. Previously they used `BrowserWindow.getAllWindows()[0]`,
 * which breaks when auxiliary windows (clipboard enhancer, quick launcher) are
 * created — their position in the array is non-deterministic, so [0] may point
 * to a window that has never registered the renderer tool bridge, causing
 * reverse-requests to silently time out.
 *
 * This module provides a stable, explicit reference instead.
 */

let mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
