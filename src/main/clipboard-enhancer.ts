/**
 * Clipboard Enhancer — ditto-style clipboard history.
 *
 * Polls clipboard for changes, stores history,
 * and shows a popup via Ctrl+Shift+V to select and paste.
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
const MAX_HISTORY = 100

const DATA_DIR = join(app.getPath('home'), '.wishful-claw')
const HISTORY_FILE = join(DATA_DIR, 'clipboard-history.json')

interface ClipboardEntry {
  id: string
  text: string
  timestamp: number
  preview: string
}

function loadHistory(): void {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        history = parsed.slice(0, MAX_HISTORY)
        lastClipboardText = history[0]?.text ?? ''
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
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, MAX_HISTORY), null, 2), {
      encoding: 'utf8',
      mode: 0o600
    })
  } catch {
    // ignore
  }
}

function pushHistoryUpdate(): void {
  if (clipboardWindow?.isVisible()) {
    safeSendMessagePackToWindow(clipboardWindow, 'clipboard:history-updated', history)
  }
}

function startClipboardPolling(): void {
  if (pollTimer) return

  pollTimer = setInterval(() => {
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
      history = history.slice(0, MAX_HISTORY)
      saveHistory()
      pushHistoryUpdate()
    }
  }, 500)
}

let ipcRegistered = false

function registerClipboardIpc(): void {
  if (ipcRegistered) return
  ipcRegistered = true

  registerMessagePackHandler<void, ClipboardEntry[]>('clipboard:get-history', () => history)

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
}

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
  const winHeight = 500

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
  // Send initial history after a brief delay to ensure renderer is ready
  setTimeout(() => pushHistoryUpdate(), 200)
}

export function registerClipboardEnhancer(): void {
  const accelerator = 'Ctrl+Shift+V'
  const ret = globalShortcut.register(accelerator, () => {
    createClipboardWindow()
  })
  if (!ret) {
    console.warn('[ClipboardEnhancer] Failed to register global shortcut:', accelerator)
  }

  loadHistory()
  startClipboardPolling()

  app.on('will-quit', () => {
    globalShortcut.unregister(accelerator)
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  })
}
