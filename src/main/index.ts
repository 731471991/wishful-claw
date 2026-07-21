import { app, BrowserWindow, shell, dialog } from 'electron'
import { join } from 'path'

import { getNativeWorker } from './lib/native-worker'
import { registerMessagePackHandler } from './ipc/messagepack-handler'
import { registerAiProviderHandlers } from './ipc/ai-provider-handlers'
import { registerSettingsHandlers } from './ipc/settings-handlers'
import { registerAgentStreamForwarder } from './ipc/agent-stream-handler'
import { safeSendMessagePackToWindow } from './window-ipc'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    // macOS: hide title bar but keep traffic lights
    // Windows/Linux: remove frame entirely for custom title bar
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hidden' as const, trafficLightPosition: { x: 12, y: 12 } }
      : { frame: false }),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Notify renderer when window is maximized/unmaximized
  mainWindow.on('maximize', () => {
    safeSendMessagePackToWindow(mainWindow!, 'window:maximized', true)
  })
  mainWindow.on('unmaximize', () => {
    safeSendMessagePackToWindow(mainWindow!, 'window:maximized', false)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerWindowControlHandlers(): void {
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

app.whenReady().then(() => {
  app.setAppUserModelId('com.wishfulclaw.app')

  // Window control handlers (minimize / maximize / close / isMaximized)
  registerWindowControlHandlers()

  // Register IPC handler: forward ping to worker
  registerMessagePackHandler<Record<string, unknown>, { ok: boolean; pid: number }>(
    'worker/ping',
    async () => {
      const worker = getNativeWorker()
      const result = await worker.request<{ ok: boolean; pid: number }>('worker/ping', {})
      return result
    }
  )

  // Generic worker request forwarder: renderer calls window.api.workerRequest(method, params)
  // and main forwards to the worker via named pipe IPC.
  registerMessagePackHandler<{ method: string; params?: unknown }, unknown>(
    'worker:request',
    async (args) => {
      const worker = getNativeWorker()
      return worker.request(args.method, args.params ?? {})
    }
  )

  // Register AI provider persistence handlers
  registerAiProviderHandlers()
  registerSettingsHandlers()

  // Agent stream event forwarder (worker → renderer)
  registerAgentStreamForwarder()

  // Dialog: open folder selector
  registerMessagePackHandler<Record<string, unknown>, { folderPath: string | null; canceled: boolean }>(
    'dialog:openFolder',
    async (_args, event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory']
      })
      return {
        folderPath: result.canceled ? null : result.filePaths[0] ?? null,
        canceled: result.canceled
      }
    }
  )


  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
