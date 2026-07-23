import { app, BrowserWindow, shell, dialog } from 'electron'
import { join } from 'path'
import * as fs from 'fs'

import { getNativeWorker } from './lib/native-worker'
import { logError, logWarn, logInfo, installGlobalExceptionHandlers, readRecentLogs } from './lib/logger'
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

  // ── File system handlers (used by agent tools and dynamic context) ──
  registerMessagePackHandler<{ path: string; maxLines?: number }, string>(
    'fs:read-file',
    async (args) => {
      try {
        const content = await fs.promises.readFile(args.path, 'utf-8')
        return content
      } catch (err) {
        // Return empty string for missing files instead of throwing
        const code = (err as NodeJS.ErrnoException).code
        if (code === 'ENOENT' || code === 'EISDIR') return ''
        throw new Error(String(err))
      }
    }
  )

  registerMessagePackHandler<{ path: string; content: string; encoding?: string }, void>(
    'fs:write-file',
    async (args) => {
      await fs.promises.writeFile(args.path, args.content, args.encoding ?? 'utf-8')
    }
  )

  registerMessagePackHandler<{ path: string }, { isDirectory: boolean; isFile: boolean; size: number; mtime: number } | null>(
    'fs:stat-path',
    async (args) => {
      try {
        const stat = await fs.promises.stat(args.path)
        return {
          isDirectory: stat.isDirectory(),
          isFile: stat.isFile(),
          size: stat.size,
          mtime: stat.mtimeMs
        }
      } catch {
        return null
      }
    }
  )

  registerMessagePackHandler<{ path: string }, { name: string; isDirectory: boolean; isFile: boolean; size: number }[]>(
    'fs:list-dir',
    async (args) => {
      try {
        const entries = await fs.promises.readdir(args.path, { withFileTypes: true })
        return entries.map((entry) => ({
          name: entry.name,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
          size: 0
        }))
      } catch {
        return []
      }
    }
  )

  registerMessagePackHandler<{ path: string; recursive?: boolean }, void>(
    'fs:mkdir',
    async (args) => {
      await fs.promises.mkdir(args.path, { recursive: args.recursive ?? true })
    }
  )

  registerMessagePackHandler<{ path: string }, void>(
    'fs:delete',
    async (args) => {
      await fs.promises.unlink(args.path)
    }
  )

  registerMessagePackHandler<{ from: string; to: string }, void>(
    'fs:move',
    async (args) => {
      await fs.promises.rename(args.from, args.to)
    }
  )

  registerMessagePackHandler<{ path: string }, string | null>(
    'fs:read-text-file-lines',
    async (args) => {
      try {
        const content = await fs.promises.readFile(args.path, 'utf-8')
        return content
      } catch {
        return null
      }
    }
  )

  registerMessagePackHandler<{ path: string }, ArrayBuffer | null>(
    'fs:read-file-binary',
    async (args) => {
      try {
        const buffer = await fs.promises.readFile(args.path)
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      } catch {
        return null
      }
    }
  )

  registerMessagePackHandler<{ path: string; content: Buffer | ArrayBuffer | Uint8Array }, void>(
    'fs:write-file-binary',
    async (args) => {
      const data = Buffer.isBuffer(args.content)
        ? args.content
        : args.content instanceof ArrayBuffer
          ? Buffer.from(args.content)
          : Buffer.from(args.content)
      await fs.promises.writeFile(args.path, data)
    }
  )

  // Glob - simple pattern matching (supports * and **)
  registerMessagePackHandler<{ pattern: string; cwd?: string }, { path: string; name: string; isDirectory: boolean }[]>(
    'fs:glob',
    async (args) => {
      try {
        const cwd = args.cwd ?? process.cwd()
        const pattern = args.pattern.replace(/\\/g, '/')
        const results: { path: string; name: string; isDirectory: boolean }[] = []
        const globToRegex = (p: string): RegExp => {
          let re = p.replace(/[.+^${}()|[\]]/g, '\\$&')
          re = re.replace(/\*\*/g, '<<GLOBSTAR>>')
          re = re.replace(/\*/g, '[^/]*')
          re = re.replace(/<<GLOBSTAR>>/g, '.*')
          re = re.replace(/\?/g, '.')
          return new RegExp('^' + re + '$')
        }
        const regex = globToRegex(pattern)
        const walk = async (dir: string, depth: number): Promise<void> => {
          if (depth > 8 || results.length > 500) return
          let entries: fs.Dirent[]
          try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch { return }
          for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
            const fullPath = join(dir, entry.name)
            const relPath = fullPath.replace(cwd, '').replace(/^[\\/]+/, '').replace(/\\/g, '/')
            if (regex.test(relPath) || regex.test(entry.name)) {
              results.push({ path: fullPath, name: entry.name, isDirectory: entry.isDirectory() })
            }
            if (entry.isDirectory() && depth < 8) {
              await walk(fullPath, depth + 1)
            }
          }
        }
        await walk(cwd, 0)
        return results
      } catch {
        return []
      }
    }
  )

  // Grep - search file contents
  registerMessagePackHandler<{ pattern: string; path?: string; glob?: string }, { file: string; line: number; text: string }[]>(
    'fs:grep',
    async (args) => {
      try {
        const cwd = args.path ?? process.cwd()
        const results: { file: string; line: number; text: string }[] = []
        const regex = new RegExp(args.pattern, 'i')
        const fileList: string[] = []
        const walk = async (dir: string, depth: number): Promise<void> => {
          if (depth > 6 || fileList.length > 1000) return
          let entries: fs.Dirent[]
          try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch { return }
          for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
            const fullPath = join(dir, entry.name)
            if (entry.isFile()) {
              fileList.push(fullPath)
            } else if (entry.isDirectory() && depth < 6) {
              await walk(fullPath, depth + 1)
            }
          }
        }
        await walk(cwd, 0)
        for (const file of fileList) {
          try {
            const content = await fs.promises.readFile(file, 'utf-8')
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                results.push({ file, line: i + 1, text: lines[i].trim() })
                if (results.length >= 200) return results
              }
            }
          } catch {
            // skip binary files
          }
        }
        return results
      } catch {
        return []
      }
    }
  )

  // Search files by name
  registerMessagePackHandler<{ query: string; path?: string }, { path: string; name: string }[]>(
    'fs:search-files',
    async (args) => {
      try {
        const cwd = args.path ?? process.cwd()
        const query = args.query.toLowerCase()
        const results: { path: string; name: string }[] = []
        const walk = async (dir: string, depth: number): Promise<void> => {
          if (depth > 5 || results.length > 200) return
          const entries = await fs.promises.readdir(dir, { withFileTypes: true })
          for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
            const fullPath = join(dir, entry.name)
            if (entry.name.toLowerCase().includes(query)) {
              results.push({ path: fullPath, name: entry.name })
            }
            if (entry.isDirectory() && depth < 5) {
              await walk(fullPath, depth + 1)
            }
          }
        }
        await walk(cwd, 0)
        return results
      } catch {
        return []
      }
    }
  )

  // Ensure default chat working folder exists (Documents/<date>/Chat)
  registerMessagePackHandler<void, { path?: string; error?: string }>(
    'fs:default-chat-working-folder',
    async () => {
      try {
        const folderPath = join(app.getPath('documents'), formatLocalDateFolderName(), 'Chat')
        await fs.promises.mkdir(folderPath, { recursive: true })
        return { path: folderPath }
      } catch (err) {
        return { error: String(err) }
      }
    }
  )

  // ── Agent history stub handlers (no persistence layer yet) ──
  registerMessagePackHandler<void, { total: number; sessions: unknown[] }>(
    'agent-history:index',
    async () => ({ total: 0, sessions: [] })
  )
  registerMessagePackHandler<{ sessionId: string }, unknown[]>(
    'agent-history:read',
    async () => []
  )
  registerMessagePackHandler<unknown, void>(
    'agent-history:apply',
    async () => undefined
  )
  registerMessagePackHandler<unknown, void>(
    'agent-history:replace',
    async () => undefined
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
