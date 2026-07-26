import { app, BrowserWindow, shell, dialog } from 'electron'
import { join } from 'path'
import * as fs from 'fs'

import { getNativeWorker } from './lib/native-worker'
import { logError, logWarn, logInfo, installGlobalExceptionHandlers, readRecentLogs } from './lib/logger'
import { registerMessagePackHandler } from './ipc/messagepack-handler'
import { registerAiProviderHandlers } from './ipc/ai-provider-handlers'
import { registerSettingsHandlers } from './ipc/settings-handlers'
import { registerAgentStreamForwarder } from './ipc/agent-stream-handler'
import { registerNativeAgentRuntimeHandlers } from './ipc/native-agent-runtime'
import { registerGitHandlers } from './ipc/git-handlers'
import { registerFsHandlers } from './ipc/fs-handlers'
import { registerTerminalHandlers } from './ipc/terminal-handlers'
import { registerAgentChangeHandlers } from './ipc/agent-change-handlers'
import { registerMcpHandlers } from './ipc/mcp-handlers'
import { registerVideoHandlers } from './ipc/video-handlers'
import { registerExtensionHandlers } from './ipc/extension-handlers'
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
      sandbox: false,
      webviewTag: true
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

  mainWindow.webContents.on("console-message", (_e, level, message, line, src) => {
    const levelStr = ["LOG","WARN","ERROR"][level] ?? "LOG"
    console.log(`[renderer:${levelStr}] ${message} (${src}:${line})`)
    if (level >= 1) {
      logWarn("renderer", `${message} (${src}:${line})`)
    }
  })
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    console.error("[renderer:CRASH]", details.reason, details.exitCode)
    logError("renderer", `Render process gone: ${details.reason} (exit code: ${details.exitCode})`)
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
  installGlobalExceptionHandlers()
  logInfo('main', 'Application started')
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
  registerMessagePackHandler<{ method: string; params?: unknown; timeoutMs?: number }, unknown>(
    'worker:request',
    async (args) => {
      const worker = getNativeWorker()
      return worker.request(args.method, args.params ?? {}, args.timeoutMs)
    }
  )

  // Register AI provider persistence handlers
  registerAiProviderHandlers()
  registerSettingsHandlers()

  // Agent stream event forwarder (worker → renderer)
  registerAgentStreamForwarder()

  // Native agent runtime: handles reverse-request from worker (e.g. browser tool calls)
  registerNativeAgentRuntimeHandlers()

  // Git IPC handlers: forward git:* channels to worker
  registerGitHandlers()


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

  // Folder picker: returns { canceled, path } for the renderer's fs:select-folder channel
  registerMessagePackHandler<{ defaultPath?: string }, { canceled: boolean; path?: string }>(
    'fs:select-folder',
    async (args, event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openDirectory'],
        ...(args.defaultPath ? { defaultPath: args.defaultPath } : {})
      })
      return {
        canceled: result.canceled,
        path: result.canceled ? undefined : result.filePaths[0]
      }
    }
  )

  // List desktop directories for the working folder selector dialog
  registerMessagePackHandler<void, { desktopPath: string; directories: { name: string; path: string; isDesktop: boolean }[] } | { error: string }>(
    'fs:list-desktop-directories',
    async () => {
      try {
        const desktopPath = app.getPath('desktop')
        const entries = await fs.promises.readdir(desktopPath, { withFileTypes: true })
        const directories = entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => ({
            name: entry.name,
            path: join(desktopPath, entry.name),
            isDesktop: false
          }))
        return { desktopPath, directories }
      } catch (err) {
        return { error: String(err) }
      }
    }
  )

  // ── File system handlers (extracted to ipc/fs-handlers.ts) ──
  registerFsHandlers()
  registerTerminalHandlers()
  registerAgentChangeHandlers()
  registerMcpHandlers()
  registerVideoHandlers()
  registerExtensionHandlers()

  // ── Agent history handlers (forwarded to C# Worker SQLite) ──
  registerMessagePackHandler<{ toolUseId: string }, unknown>(
    'agent-history:read-by-tool-use-id',
    async (args) => getNativeWorker().request('db/sub-agent-read-by-tool-use-id', args)
  )
  registerMessagePackHandler<void, { total: number; sessions: unknown[] }>(
    'agent-history:index',
    async () => getNativeWorker().request('db/sub-agent-index', {})
  )
  registerMessagePackHandler<{ sessionId: string }, unknown[]>(
    'agent-history:read',
    async (args) => getNativeWorker().request('db/sub-agent-read-session', args)
  )
  registerMessagePackHandler<{
    upserts?: unknown[]
    removeIds?: string[]
    removeSessionIds?: string[]
  }, void>(
    'agent-history:apply',
    async (args) => { await getNativeWorker().request('db/sub-agent-apply', args) }
  )
  registerMessagePackHandler<{ snapshot: unknown }, void>(
    'agent-history:replace',
    async (args) => { await getNativeWorker().request('db/sub-agent-replace', args) }
  )
  // ── SSH stub handlers ──
  registerMessagePackHandler<unknown, unknown[]>(
    'ssh:connection:list',
    async () => []
  )

  // ── Skills stub handlers ──
  registerMessagePackHandler<unknown, unknown[]>(
    'skills:list',
    async () => []
  )
  registerMessagePackHandler<unknown, unknown[]>(
    'agents:list',
    async () => []
  )
  registerMessagePackHandler<unknown, unknown[]>(
    'commands:list',
    async () => []
  )
  registerMessagePackHandler<unknown, unknown[]>(
    'prompts:list',
    async () => []
  )


  // ── Config stub handlers (key-value store, same pattern as settings) ──
  registerMessagePackHandler<string, unknown | null>(
    'config:get',
    () => null
  )
  registerMessagePackHandler<{ key: string; value: unknown }, { success: boolean }>(
    'config:set',
    () => ({ success: true })
  )

  // ── Input draft stub handlers ──
  registerMessagePackHandler<string, unknown | null>(
    'input-draft:get',
    () => null
  )
  registerMessagePackHandler<unknown, void>(
    'input-draft:set',
    () => undefined
  )
  registerMessagePackHandler<string, void>(
    'input-draft:remove',
    () => undefined
  )
  registerMessagePackHandler<void, unknown[]>(
    'input-draft:list',
    () => []
  )
  registerMessagePackHandler<void, void>(
    'input-draft:cleanup',
    () => undefined
  )

  // ── DB stub handlers (no SQLite layer yet) ──
  registerMessagePackHandler<string, unknown[] | null>(
    'db:messages:list-locator:msgpack',
    async () => null
  )
  registerMessagePackHandler<string, unknown | null>(
    'db:goals:get:msgpack',
    async () => null
  )
  registerMessagePackHandler<string, unknown[]>(
    'db:goal-events:list:msgpack',
    async () => []
  )
  registerMessagePackHandler<unknown, void>(
    'db:goal-events:add:msgpack',
    async () => undefined
  )

  // ── Agent changes stub handlers ──
  registerMessagePackHandler<{ sessionId: string }, unknown[]>(
    'agent:changes:list-session',
    async () => []
  )
  registerMessagePackHandler<unknown, unknown[]>(
    'agent:changes:list-project',
    async () => []
  )
  registerMessagePackHandler<unknown, unknown>(
    'agent:changes:diff-content',
    async () => null
  )
  registerMessagePackHandler<unknown, { success: boolean }>(
    'agent:changes:undo-run',
    async () => ({ success: false })
  )
  registerMessagePackHandler<unknown, { success: boolean }>(
    'agent:changes:undo-file',
    async () => ({ success: false })
  )

  // -- Log handlers --
  registerMessagePackHandler<{ level: string; message: string; stack?: string; extra?: Record<string, unknown> }, void>(
    'log:write',
    async (args) => {
      const fn = args.level === 'error' ? logError : args.level === 'warn' ? logWarn : logInfo
      fn('renderer', args.message, { stack: args.stack, extra: args.extra })
    }
  )

  registerMessagePackHandler<{ maxLines?: number }, string>(
    'log:read',
    async (args) => {
      return readRecentLogs(args.maxLines ?? 500)
    }
  )

  // -- Shell handlers --
  registerMessagePackHandler<string, void>(
    'shell:openExternal',
    async (args) => {
      await shell.openExternal(args)
    }
  )

  registerMessagePackHandler<string, void>(
    'shell:openPath',
    async (args) => {
      await shell.openPath(args)
    }
  )

  // -- File selection dialog --
  registerMessagePackHandler<{ multiSelections?: boolean }, { canceled: boolean; path: string; paths: string[] }>(
    'fs:select-file',
    async (args) => {
      const properties: ('openFile' | 'multiSelections')[] = ['openFile']
      if (args?.multiSelections) properties.push('multiSelections')
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: properties as ('openFile' | 'multiSelections')[]
      })
      return {
        canceled: result.canceled,
        path: result.filePaths[0] ?? '',
        paths: result.filePaths
      }
    }
  )

  // -- File watch handlers --
  const watchedFiles = new Map<string, fs.FSWatcher>()

  registerMessagePackHandler<{ path: string }, { path: string }>(
    'fs:watch-file',
    async (args) => {
      const filePath = args.path
      if (watchedFiles.has(filePath)) {
        return { path: filePath }
      }
      try {
        const watcher = fs.watch(filePath, { persistent: false }, (eventType) => {
          if (eventType === 'change') {
            safeSendMessagePackToWindow(mainWindow!, 'fs:file-changed', { path: filePath })
          }
        })
        watcher.on('error', () => {
          watchedFiles.delete(filePath)
        })
        watchedFiles.set(filePath, watcher)
        return { path: filePath }
      } catch {
        return { path: filePath }
      }
    }
  )

  registerMessagePackHandler<{ path: string }, void>(
    'fs:unwatch-file',
    async (args) => {
      const watcher = watchedFiles.get(args.path)
      if (watcher) {
        watcher.close()
        watchedFiles.delete(args.path)
      }
    }
  )

  // -- Browser emulation status (stub -- returns defaults) --
  registerMessagePackHandler<void, { success: true; status: { reuseEnabled: boolean; userAgent: string } }>(
    'browser:emulation-status',
    async () => {
      return { success: true, status: { reuseEnabled: false, userAgent: '' } }
    }
  )

  createWindow()

function formatLocalDateFolderName(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
