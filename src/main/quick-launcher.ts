/**
 * Quick Launcher — Ctrl+Alt+Space global shortcut launcher (utools-style).
 *
 * Scans Windows Start Menu .lnk files, provides fuzzy search,
 * and launches the selected application.
 */

import { app, BrowserWindow, globalShortcut, shell, screen } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { registerMessagePackHandler } from './ipc/messagepack-handler'

let launcherWindow: BrowserWindow | null = null
let appListCache: AppShortcut[] | null = null
let cacheTime = 0

interface AppShortcut {
  name: string
  path: string
  iconPath?: string
}

const CACHE_TTL_MS = 5 * 60 * 1000

/** Scan Windows Start Menu directories for .lnk shortcut files. */
function scanStartMenuApps(): AppShortcut[] {
  const homeDir = app.getPath('home')
  const programs = [
    join(homeDir, 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs'
  ]

  const shortcuts: AppShortcut[] = []
  const seen = new Set<string>()

  for (const dir of programs) {
    if (!fs.existsSync(dir)) continue
    walkLnkFiles(dir, shortcuts, seen)
  }

  shortcuts.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  return shortcuts
}

function walkLnkFiles(dir: string, results: AppShortcut[], seen: Set<string>): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkLnkFiles(fullPath, results, seen)
    } else if (entry.name.toLowerCase().endsWith('.lnk')) {
      const name = entry.name.replace(/\.lnk$/i, '')
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      results.push({ name, path: fullPath })
    }
  }
}

function getOrRefreshAppList(): AppShortcut[] {
  const now = Date.now()
  if (appListCache && now - cacheTime < CACHE_TTL_MS) {
    return appListCache
  }
  appListCache = scanStartMenuApps()
  cacheTime = now
  return appListCache
}

let ipcRegistered = false

function registerLauncherIpc(): void {
  if (ipcRegistered) return
  ipcRegistered = true

  registerMessagePackHandler<string, AppShortcut[]>('launcher:search', (query) => {
    const apps = getOrRefreshAppList()
    if (!query || query.trim().length === 0) {
      return apps.slice(0, 20)
    }
    const q = query.toLowerCase()
    return apps.filter((app) => app.name.toLowerCase().includes(q)).slice(0, 50)
  })

  registerMessagePackHandler<string, boolean>('launcher:launch', (appPath) => {
    shell.openPath(appPath)
    launcherWindow?.hide()
    return true
  })
}

export function createLauncherWindow(): void {
  registerLauncherIpc()

  if (launcherWindow) {
    if (launcherWindow.isVisible()) {
      launcherWindow.hide()
    } else {
      launcherWindow.show()
      launcherWindow.focus()
    }
    return
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  const winWidth = 600
  const winHeight = 400

  launcherWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: Math.round((screenWidth - winWidth) / 2),
    y: Math.round((screenHeight - winHeight) / 2 - 100),
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  launcherWindow.on('blur', () => {
    launcherWindow?.hide()
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    launcherWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/launcher.html`)
  } else {
    launcherWindow.loadFile(join(__dirname, '../renderer/launcher.html'))
  }

  launcherWindow.show()
  launcherWindow.focus()
}

export function registerQuickLauncher(): void {
  const accelerator = 'Ctrl+Alt+Space'
  const ret = globalShortcut.register(accelerator, () => {
    createLauncherWindow()
  })
  if (!ret) {
    console.warn('[QuickLauncher] Failed to register global shortcut:', accelerator)
  }

  app.on('will-quit', () => {
    globalShortcut.unregister(accelerator)
  })
}
