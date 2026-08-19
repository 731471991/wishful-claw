import { app, BrowserWindow } from 'electron'
import { registerMessagePackHandler } from './messagepack-handler'

/**
 * Login item (auto-start) IPC handlers.
 * Uses Electron's native app.setLoginItemSettings API.
 * In dev mode this registers electron.exe; in packaged builds it registers the app exe.
 */
export function registerLoginItemHandlers(): void {
  registerMessagePackHandler<void, boolean>('app:get-login-item-settings', () => {
    const settings = app.getLoginItemSettings()
    return settings.openAtLogin
  })

  registerMessagePackHandler<boolean, boolean>('app:set-login-item-settings', (openAtLogin) => {
    app.setLoginItemSettings({ openAtLogin })
    return app.getLoginItemSettings().openAtLogin
  })
}

export function registerWindowControlHandlers(): void {
  registerMessagePackHandler<void>('window:minimize', (_args, event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  registerMessagePackHandler<void>('window:maximize', (_args, event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  registerMessagePackHandler<void>('window:close', (_args, event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  registerMessagePackHandler<void, boolean>('window:isMaximized', (_args, event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })
}
