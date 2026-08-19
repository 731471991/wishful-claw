/**
 * Quick Launcher — configurable global shortcut launcher (utools-style).
 *
 * Scans Windows Start Menu .lnk files, provides fuzzy search,
 * and launches the selected application.
 *
 * Shortcut is stored in ~/.wishful-claw/launcher-config.json and can be
 * modified from both the main settings page and (future) the launcher window.
 */

import { app, BrowserWindow, shell, screen, dialog } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { pinyin } from 'pinyin-pro'
import { registerMessagePackHandler } from './ipc/messagepack-handler'
import { registerPriorityShortcut, unregisterPriorityShortcut } from './priority-shortcuts'
import { safeSendMessagePackToWindow } from './window-ipc'

let launcherWindow: BrowserWindow | null = null
let appListCache: AppShortcut[] | null = null
let cacheTime = 0
let config: LauncherConfig
const iconCache = new Map<string, string | null>()

interface AppShortcut {
  name: string
  path: string
  iconDataUrl?: string
  pinyinFull?: string
  pinyinInitials?: string
}

interface CustomApp {
  name: string
  path: string
}

interface LauncherConfig {
  enabled: boolean
  accelerators: string[]
  customApps: CustomApp[]
  launchHistory: CustomApp[]
}

const CACHE_TTL_MS = 5 * 60 * 1000

const DATA_DIR = join(app.getPath('home'), '.wishful-claw')
const CONFIG_FILE = join(DATA_DIR, 'launcher-config.json')

const DEFAULT_CONFIG: LauncherConfig = {
  enabled: true,
  accelerators: ['Alt+Space'],
  customApps: [],
  launchHistory: []
}

// ── Config persistence ──

function loadConfig(): LauncherConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
      const parsed = JSON.parse(raw)
      // Migrate old single accelerator to array
      let accelerators = DEFAULT_CONFIG.accelerators
      if (Array.isArray(parsed.accelerators)) {
        accelerators = parsed.accelerators.filter((value: unknown): value is string => typeof value === 'string')
        accelerators = accelerators.filter((value, index) => accelerators.indexOf(value) === index)
      } else if (typeof parsed.accelerator === 'string') {
        accelerators = [parsed.accelerator]
      }
      return {
        enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
        accelerators: accelerators.length > 0 ? accelerators : DEFAULT_CONFIG.accelerators,
        customApps: Array.isArray(parsed.customApps) ? parsed.customApps : [],
        launchHistory: Array.isArray(parsed.launchHistory) ? parsed.launchHistory : []
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

const registeredIds: string[] = []

function unregisterShortcut(): void {
  for (const id of registeredIds) {
    unregisterPriorityShortcut(id)
  }
  registeredIds.length = 0
}

function registerShortcut(): boolean {
  unregisterShortcut()
  if (!config.enabled) return false
  let allOk = true
  for (let i = 0; i < config.accelerators.length; i++) {
    const id = `quick-launcher-${i}`
    const ok = registerPriorityShortcut(id, config.accelerators[i], () => {
      createLauncherWindow()
    })
    registeredIds.push(id)
    if (!ok) allOk = false
  }
  return allOk
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

  // Pre-compute pinyin for Chinese names
  for (const s of shortcuts) {
    if (/[\u4e00-\u9fff]/.test(s.name)) {
      const full = pinyin(s.name, { toneType: 'none', type: 'array' }).join('')
      const initials = pinyin(s.name, { toneType: 'none', pattern: 'first', type: 'array' }).join('')
      s.pinyinFull = full
      s.pinyinInitials = initials
    }
  }

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
  const startMenuApps = scanStartMenuApps()
  const seen = new Set<string>()

  // Merge custom apps
  for (const custom of config.customApps) {
    const key = custom.name.toLowerCase()
    if (!seen.has(key) && fs.existsSync(custom.path)) {
      seen.add(key)
      startMenuApps.push({
        name: custom.name,
        path: custom.path,
        pinyinFull: undefined,
        pinyinInitials: undefined
      })
    }
  }

  // Merge launch history (apps that were launched but not in Start Menu or custom apps)
  for (const hist of config.launchHistory) {
    const key = hist.name.toLowerCase()
    if (!seen.has(key) && fs.existsSync(hist.path)) {
      seen.add(key)
      startMenuApps.push({
        name: hist.name,
        path: hist.path,
        pinyinFull: undefined,
        pinyinInitials: undefined
      })
    }
  }

  // Compute pinyin for any Chinese names that don't have it yet
  for (const s of startMenuApps) {
    if (!s.pinyinFull && /[\u4e00-\u9fff]/.test(s.name)) {
      s.pinyinFull = pinyin(s.name, { toneType: 'none', type: 'array' }).join('')
      s.pinyinInitials = pinyin(s.name, { toneType: 'none', pattern: 'first', type: 'array' }).join('')
    }
  }

  startMenuApps.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  appListCache = startMenuApps
  cacheTime = now
  return appListCache
}

async function withIcon(appShortcut: AppShortcut): Promise<AppShortcut> {
  if (iconCache.has(appShortcut.path)) {
    return { ...appShortcut, iconDataUrl: iconCache.get(appShortcut.path) ?? undefined }
  }

  try {
    // For .lnk files, resolve the target EXE and extract its icon for better quality
    let iconSource = appShortcut.path
    if (appShortcut.path.toLowerCase().endsWith('.lnk')) {
      try {
        const details = shell.readShortcutLink(appShortcut.path)
        if (details.target && fs.existsSync(details.target)) {
          iconSource = details.target
        }
      } catch {
        // Fall back to the .lnk itself
      }
    }

    const icon = await app.getFileIcon(iconSource, { size: 'normal' })
    const iconDataUrl = icon.isEmpty() ? null : icon.toDataURL()
    iconCache.set(appShortcut.path, iconDataUrl)
    return { ...appShortcut, iconDataUrl: iconDataUrl ?? undefined }
  } catch {
    iconCache.set(appShortcut.path, null)
    return appShortcut
  }
}

async function searchApps(query: string): Promise<AppShortcut[]> {
  const normalizedQuery = query.trim().toLowerCase()
  if (normalizedQuery.length === 0) return []
  const apps = getOrRefreshAppList()
  const matches = apps.filter((appShortcut) => {
    const name = appShortcut.name.toLowerCase()
    if (name.includes(normalizedQuery)) return true
    if (appShortcut.pinyinFull && appShortcut.pinyinFull.toLowerCase().includes(normalizedQuery)) return true
    if (appShortcut.pinyinInitials && appShortcut.pinyinInitials.toLowerCase().includes(normalizedQuery)) return true
    return false
  }).slice(0, 50)
  return Promise.all(matches.map(withIcon))
}

// ── IPC ──

let ipcRegistered = false

function registerLauncherIpc(): void {
  if (ipcRegistered) return
  ipcRegistered = true

  registerMessagePackHandler<string, AppShortcut[]>('launcher:search', (query) => searchApps(query))

  registerMessagePackHandler<void, AppShortcut[]>('launcher:get-recent', async () => {
    if (config.launchHistory.length === 0) return []
    const recent = config.launchHistory.slice(0, 8)
    return Promise.all(recent.map(async (entry) => withIcon({ name: entry.name, path: entry.path })))
  })

  registerMessagePackHandler<string, boolean>('launcher:launch', (appPath) => {
    shell.openPath(appPath)
    // Record launch history
    const apps = getOrRefreshAppList()
    const launched = apps.find((a) => a.path === appPath)
    if (launched) {
      const entry: CustomApp = { name: launched.name, path: launched.path }
      config.launchHistory = config.launchHistory.filter((h) => h.path !== appPath)
      config.launchHistory.unshift(entry)
      if (config.launchHistory.length > 30) config.launchHistory = config.launchHistory.slice(0, 30)
      saveConfig()
    }
    launcherWindow?.hide()
    return true
  })

  registerMessagePackHandler<void, { canceled: boolean; path?: string; name?: string }>('launcher:pick-exe', async () => {
    const result = await dialog.showOpenDialog(launcherWindow!, {
      title: '选择应用程序',
      filters: [{ name: '应用程序', extensions: ['exe', 'bat', 'cmd'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true }
    }
    const filePath = result.filePaths[0]
    const name = filePath.split(/[\\/]/).pop()!.replace(/\.(exe|bat|cmd)$/i, '')
    return { canceled: false, path: filePath, name }
  })

  // ── Config IPC ──

  registerMessagePackHandler<void, LauncherConfig>('launcher:get-config', () => config)

  registerMessagePackHandler<void, CustomApp[]>('launcher:get-custom-apps', () => config.customApps)

  registerMessagePackHandler<{ name: string; path: string }, CustomApp[]>('launcher:add-custom-app', (app) => {
    if (!app.name || !app.path) return config.customApps
    if (!fs.existsSync(app.path)) return config.customApps
    if (config.customApps.some((a) => a.path === app.path)) return config.customApps
    config.customApps.push({ name: app.name, path: app.path })
    saveConfig()
    appListCache = null
    return config.customApps
  })

  registerMessagePackHandler<string, CustomApp[]>('launcher:remove-custom-app', (appPath) => {
    config.customApps = config.customApps.filter((a) => a.path !== appPath)
    saveConfig()
    appListCache = null
    return config.customApps
  })

  registerMessagePackHandler<Partial<LauncherConfig>, LauncherConfig & { shortcutRegistered: boolean }>('launcher:update-config', (patch) => {
    const wasEnabled = config.enabled
    config = { ...config, ...patch }
    saveConfig()

    let shortcutRegistered = true
    if (patch.enabled !== undefined || patch.accelerators !== undefined) {
      if (!config.enabled) {
        unregisterShortcut()
      } else if (patch.accelerators !== undefined || !wasEnabled) {
        shortcutRegistered = registerShortcut()
      }
    }

    return { ...config, shortcutRegistered }
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
      // Reset/focus is driven by the 'show' event listener below (event-driven,
      // no fixed-delay race)
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
    backgroundColor: '#00000000',
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

  // Send reset event after show so renderer clears input and focuses.
  // A short delay lets the window finish activating on Windows (transparent
  // alwaysOnTop windows can drop the first focus call when shown too early).
  launcherWindow.on('show', () => {
    setTimeout(() => {
      if (!launcherWindow?.isVisible()) return
      launcherWindow.focus()
      safeSendMessagePackToWindow(launcherWindow, 'launcher:reset', null)
    }, 30)
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
