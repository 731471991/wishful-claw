import { app, BrowserWindow, Notification, shell, dialog } from 'electron'
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
import { registerWebSearchHandlers } from './ipc/web-search-handlers'
import { registerSshHandlers, cleanupSshHandlers } from './ipc/ssh-handlers'
import { registerSkillHandlers } from './ipc/skill-handlers'
import { registerSshFsHandlers } from './ipc/ssh-fs-handlers'
import { ChannelManager } from './channels/channel-manager'
import { registerBuiltInChannelProviders } from './channels/register-providers'
import { registerChannelHandlers, autoStartChannels } from './ipc/channel-handlers'
import { setPluginManager } from './channels/auto-reply'
import { safeSendMessagePackToWindow } from './window-ipc'

let mainWindow: BrowserWindow | null = null
let channelManager: ChannelManager | null = null

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
    icon: join(app.getAppPath(), 'resources', 'icon-256.png'),
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

app.setName('WishfulClaw')

app.whenReady().then(() => {
  installGlobalExceptionHandlers()
  logInfo('main', 'Application started')
  app.setAppUserModelId('com.wishfulclaw.app')

  // Window control handlers (minimize / maximize / close / isMaximized)
  registerWindowControlHandlers()

  // Desktop notification handler — renderer calls this when agent loop ends
  // and the window is NOT focused (user is away from the app).
  registerMessagePackHandler<{ title: string; body: string; type?: string }, { success: boolean }>(
    'notification:show',
    async (args) => {
      if (!Notification.isSupported()) {
        return { success: false }
      }
      const notification = new Notification({
        title: args.title,
        body: args.body,
        urgency: args.type === 'error' ? 'critical' : 'normal'
      })
      notification.show()
      return { success: true }
    }
  )

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
      const opts: Electron.OpenDialogOptions = { properties: ['openDirectory'] }
      if (args && typeof args.defaultPath === 'string') {
        opts.defaultPath = args.defaultPath
      }
      const result = await dialog.showOpenDialog(win!, opts)
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
registerWebSearchHandlers()

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
  // ── SSH handlers ──
  registerSshHandlers()
  registerSshFsHandlers()

  // ── Skills handlers ──
  registerSkillHandlers()

  // -- Channel system initialization --
  channelManager = new ChannelManager()
  registerBuiltInChannelProviders(channelManager)
  registerChannelHandlers(channelManager)
  setPluginManager(channelManager)
  logInfo('main', 'Channel system initialized')

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
  // ── Goal DB handlers (forwarded to Worker) ──
  registerMessagePackHandler<Record<string, unknown>, unknown[]>(
    'db:goals:list:msgpack',
    async (args) => getNativeWorker().request('db/goals-list', args)
  )
  registerMessagePackHandler<string, unknown | null>(
    'db:goals:get:msgpack',
    async (sessionId) => getNativeWorker().request('db/goals-get', { sessionId })
  )
  registerMessagePackHandler<Record<string, unknown>, unknown>(
    'db:goals:create:msgpack',
    async (args) => getNativeWorker().request('db/goals-create', args)
  )
  registerMessagePackHandler<Record<string, unknown>, unknown>(
    'db:goals:set:msgpack',
    async (args) => getNativeWorker().request('db/goals-set', args)
  )
  registerMessagePackHandler<Record<string, unknown>, unknown>(
    'db:goals:update:msgpack',
    async (args) => getNativeWorker().request('db/goals-update', args)
  )
  registerMessagePackHandler<string, unknown>(
    'db:goals:clear:msgpack',
    async (sessionId) => getNativeWorker().request('db/goals-clear', { sessionId })
  )
  registerMessagePackHandler<Record<string, unknown>, unknown>(
    'db:goals:account:msgpack',
    async (args) => getNativeWorker().request('db/goals-account', args)
  )
  registerMessagePackHandler<Record<string, unknown>, unknown[]>(
    'db:goal-events:list:msgpack',
    async (args) => getNativeWorker().request('db/goal-events-list', args)
  )
  registerMessagePackHandler<Record<string, unknown>, unknown>(
    'db:goal-events:add:msgpack',
    async (args) => getNativeWorker().request('db/goal-events-add', args)
  )
  // -- Goal control handlers --
  registerMessagePackHandler<Record<string, unknown>, unknown>(
    'goal:pause:msgpack',
    async (args) => getNativeWorker().request('goal/pause', args)
  )
  registerMessagePackHandler<Record<string, unknown>, unknown>(
    'goal:resume:msgpack',
    async (args) => getNativeWorker().request('goal/resume', args)
  )
  registerMessagePackHandler<Record<string, unknown>, unknown>(
    'goal:abort:msgpack',
    async (args) => getNativeWorker().request('goal/abort', args)
  )
  registerMessagePackHandler<Record<string, unknown>, unknown>(
    'goal:status:msgpack',
    async (args) => getNativeWorker().request('goal/status', args),

    'goal:confirm:msgpack',
    async (args) => getNativeWorker().request('goal/confirm', args)
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

  // -- Image persistence (browser screenshots, generated images) --
  const GENERATED_IMAGES_DIR = 'wishful-claw'
  const GENERATED_IMAGES_SUBDIR = 'image'

  function getGeneratedImagesDir(): string {
    const { homedir } = require('os')
    const dir = join(homedir(), GENERATED_IMAGES_DIR, GENERATED_IMAGES_SUBDIR)
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  function guessExtensionFromMimeType(mediaType?: string): string {
    switch ((mediaType || '').toLowerCase()) {
      case 'image/jpeg':
        return '.jpg'
      case 'image/webp':
        return '.webp'
      case 'image/gif':
        return '.gif'
      case 'image/bmp':
        return '.bmp'
      default:
        return '.png'
    }
  }

  registerMessagePackHandler<{ data?: string; mediaType?: string; url?: string; filePath?: string }, { filePath?: string; mediaType?: string; data?: string; error?: string }>(
    'image:persist-generated',
    async (args) => {
      try {
        let buffer: Buffer
        if (typeof args.data === 'string' && args.data.trim()) {
          buffer = Buffer.from(args.data, 'base64')
        } else {
          return { error: 'Missing image data' }
        }
        const mediaType = args.mediaType || 'image/png'
        const fileExt = guessExtensionFromMimeType(mediaType)
        const { randomUUID } = require('crypto')
        const filePath = join(getGeneratedImagesDir(), `${Date.now()}-${randomUUID()}${fileExt}`)
        fs.writeFileSync(filePath, buffer)
        return {
          filePath,
          mediaType,
          data: args.data
        }
      } catch (err) {
        return { error: String(err) }
      }
    }
  )

  createWindow()

  // Auto-start enabled channels after window is ready
  if (channelManager) {
    void autoStartChannels(channelManager)
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

app.on('before-quit', () => {
  cleanupSshHandlers()
  if (channelManager) {
    void channelManager.stopAll()
  }
})
