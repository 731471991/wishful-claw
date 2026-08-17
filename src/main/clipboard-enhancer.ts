/**
 * Clipboard Enhancer — ditto-style clipboard history.
 *
 * - Polls clipboard (250ms) for near-instant capture
 * - Stores history with expiry (configurable days)
 * - Popup via configurable global shortcut
 * - Independent config file (not in settings-store)
 */

import { app, BrowserWindow, globalShortcut, clipboard, screen } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { registerMessagePackHandler } from './ipc/messagepack-handler'
import { safeSendMessagePackToWindow } from './window-ipc'

let clipboardWindow: BrowserWindow | null = null
let pollTimer: NodeJS.Timeout | null = null
let lastClipboardText = ''
let history: ClipboardEntry[] = []
let config: ClipboardConfig
let currentAccelerator: string | null = null

const DATA_DIR = join(app.getPath('home'), '.wishful-claw')
const HISTORY_FILE = join(DATA_DIR, 'clipboard-history.json')
const CONFIG_FILE = join(DATA_DIR, 'clipboard-config.json')

const DEFAULT_CONFIG: ClipboardConfig = {
  enabled: true,
  maxDays: 7,
  maxItems: 100,
  accelerator: 'Ctrl+Shift+V'
}

interface ClipboardEntry {
  id: string
  text: string
  timestamp: number
  preview: string
}

interface ClipboardConfig {
  enabled: boolean
  maxDays: number
  maxItems: number
  accelerator: string
}

// ── Config persistence ──

function loadConfig(): ClipboardConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
      const parsed = JSON.parse(raw)
      return {
        enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
        maxDays: typeof parsed.maxDays === 'number' ? parsed.maxDays : DEFAULT_CONFIG.maxDays,
        maxItems: typeof parsed.maxItems === 'number' ? parsed.maxItems : DEFAULT_CONFIG.maxItems,
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

// ── History persistence ──

function loadHistory(): void {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        history = parsed.slice(0, config.maxItems)
        lastClipboardText = history[0]?.text ?? ''
        purgeExpired()
      }
    }
  } catch {
    // ignore
  }
}

function saveHistory(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 })
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, config.maxItems), null, 2), {
      encoding: 'utf8',
      mode: 0o600
    })
  } catch {
    // ignore
  }
}

/** Remove entries older than maxDays. */
function purgeExpired(): void {
  if (config.maxDays <= 0) return
  const cutoff = Date.now() - config.maxDays * 24 * 60 * 60 * 1000
  const before = history.length
  history = history.filter((entry) => entry.timestamp >= cutoff)
  if (history.length !== before) {
    saveHistory()
  }
}

// ── Clipboard polling ──

function pushHistoryUpdate(): void {
  if (clipboardWindow?.isVisible()) {
    safeSendMessagePackToWindow(clipboardWindow, 'clipboard:history-updated', history)
  }
}

function startClipboardPolling(): void {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    if (!config.enabled) return
    const text = clipboard.readText()
    if (text && text !== lastClipboardText) {
      lastClipboardText = text
      const entry: ClipboardEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text,
        timestamp: Date.now(),
        preview: text.slice(0, 200).replace(/\n/g, ' ')
      }
      // Deduplicate
      history = history.filter((item) => item.text !== text)
      history.unshift(entry)
      history = history.slice(0, config.maxItems)
      saveHistory()
      pushHistoryUpdate()
    }
  }, 250)
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
    createClipboardWindow()
  })
  if (ret) {
    currentAccelerator = config.accelerator
  } else {
    console.warn('[ClipboardEnhancer] Failed to register shortcut:', config.accelerator)
  }
}

// ── IPC ──

let ipcRegistered = false

function registerClipboardIpc(): void {
  if (ipcRegistered) return
  ipcRegistered = true

  registerMessagePackHandler<void, ClipboardEntry[]>('clipboard:get-history', () => {
    purgeExpired()
    return history
  })

  registerMessagePackHandler<string, boolean>('clipboard:copy', (text) => {
    clipboard.writeText(text)
    lastClipboardText = text
    clipboardWindow?.hide()
    return true
  })

  registerMessagePackHandler<string, ClipboardEntry[]>('clipboard:delete', (id) => {
    history = history.filter((item) => item.id !== id)
    saveHistory()
    return history
  })

  registerMessagePackHandler<void, ClipboardEntry[]>('clipboard:clear', () => {
    history = []
    saveHistory()
    return []
  })

  // ── Config IPC ──

  registerMessagePackHandler<void, ClipboardConfig>('clipboard:get-config', () => config)

  registerMessagePackHandler<void, void>('clipboard:hide', () => {
    clipboardWindow?.hide()
  })

  registerMessagePackHandler<Partial<ClipboardConfig>, ClipboardConfig>('clipboard:update-config', (patch) => {
    const oldAccelerator = config.accelerator
    const wasEnabled = config.enabled
    config = { ...config, ...patch }
    saveConfig()

    // Apply changes
    if (patch.maxDays !== undefined) {
      purgeExpired()
    }
    if (patch.maxItems !== undefined && history.length > config.maxItems) {
      history = history.slice(0, config.maxItems)
      saveHistory()
    }
    if (patch.enabled !== undefined || patch.accelerator !== undefined) {
      if (!config.enabled) {
        unregisterShortcut()
      } else if (config.accelerator !== oldAccelerator || !wasEnabled) {
        registerShortcut()
      }
    }

    pushHistoryUpdate()
    return config
  })
}

// ── Window ──

export function createClipboardWindow(): void {
  registerClipboardIpc()

  if (clipboardWindow) {
    if (clipboardWindow.isVisible()) {
      clipboardWindow.hide()
    } else {
      clipboardWindow.show()
      clipboardWindow.focus()
      pushHistoryUpdate()
    }
    return
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  const winWidth = 420
  const winHeight = 560

  clipboardWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: Math.round((screenWidth - winWidth) / 2),
    y: Math.round((screenHeight - winHeight) / 2 - 50),
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

  clipboardWindow.on('blur', () => {
    clipboardWindow?.hide()
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    clipboardWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/clipboard.html`)
  } else {
    clipboardWindow.loadFile(join(__dirname, '../renderer/clipboard.html'))
  }

  clipboardWindow.show()
  clipboardWindow.focus()
  setTimeout(() => pushHistoryUpdate(), 200)
}

// ── Init ──

export function registerClipboardEnhancer(): void {
  config = loadConfig()
  registerClipboardIpc()
  loadHistory()
  purgeExpired()
  startClipboardPolling()
  registerShortcut()

  // Periodic purge every 10 minutes
  setInterval(() => purgeExpired(), 10 * 60 * 1000)

  app.on('will-quit', () => {
    unregisterShortcut()
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  })
}
