/**
 * Quick Launcher — configurable global shortcut launcher (utools-style).
 *
 * Scans Windows Start Menu .lnk files, provides fuzzy search,
 * and launches the selected application.
 *
 * Shortcut is stored in ~/.wishful-claw/launcher-config.json and can be
 * modified from both the main settings page and (future) the launcher window.
 */

import { app, BrowserWindow, globalShortcut, shell, screen } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { registerMessagePackHandler } from './ipc/messagepack-handler'

let launcherWindow: BrowserWindow | null = null
let appListCache: AppShortcut[] | null = null
let cacheTime = 0
let currentAccelerator: string | null = null
let config: LauncherConfig

interface AppShortcut {
  name: string
  path: string
  iconPath?: string
}

interface LauncherConfig {
  enabled: boolean
  accelerator: string
}

const CACHE_TTL_MS = 5 * 60 * 1000

const DATA_DIR = join(app.getPath('home'), '.wishful-claw')
const CONFIG_FILE = join(DATA_DIR, 'launcher-config.json')

const DEFAULT_CONFIG: LauncherConfig = {
  enabled: true,
  accelerator: 'Ctrl+Alt+Space'
}

// ── Config persistence ──

function loadConfig(): LauncherConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
      const parsed = JSON.parse(raw)
      return {
        enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
        accelerator: typeof parsed.accelerator === 'string' ? parsed.accelerator : DEFAULT_CONFIG.accelerator
      }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG }
}

function saveConfig(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 })
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
      encoding: 'utf8',
      mode: 0o600
    })
  } catch {
    // ignore
  }
}

// ── Shortcut registration ──

function unregisterShortcut(): void {
  if (currentAccelerator) {
    globalShortcut.unregister(currentAccelerator)
    currentAccelerator = null
  }
}

function registerShortcut(): void {
  unregisterShortcut()
  if (!config.enabled) return
  const ret = globalShortcut.register(config.accelerator, () => {
    createLauncherWindow()
  })
  if (ret) {
    currentAccelerator = config.accelerator
  } else {
    console.warn('[QuickLauncher] Failed to register shortcut:', config.accelerator)
  }
}

// ── App scanning ──

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

// ── IPC ──

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

  // ── Config IPC ──

  registerMessagePackHandler<void, LauncherConfig>('launcher:get-config', () => config)

  registerMessagePackHandler<Partial<LauncherConfig>, LauncherConfig>('launcher:update-config', (patch) => {
    const wasEnabled = config.enabled
    config = { ...config, ...patch }
    saveConfig()

    if (patch.enabled !== undefined || patch.accelerator !== undefined) {
      if (!config.enabled) {
        unregisterShortcut()
      } else if (patch.accelerator !== undefined || !wasEnabled) {
        registerShortcut()
      }
    }

    return config
  })
}

// ── Window ──

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

// ── Init ──

export function registerQuickLauncher(): void {
  config = loadConfig()
  registerLauncherIpc()
  registerShortcut()

  app.on('will-quit', () => {
    unregisterShortcut()
  })
}
