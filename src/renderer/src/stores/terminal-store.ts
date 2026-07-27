import { create } from 'zustand'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'

// ─── Types ───

export interface TerminalTab {
  id: string
  title: string
  shell: string
  cwd: string
  status: 'running' | 'exited' | 'error'
  exitCode?: number
  createdAt: number
}

interface TerminalStore {
  tabs: TerminalTab[]
  activeTabId: string | null
  _initialized: boolean

  init: () => void
  createTab: (cwd?: string) => Promise<string | null>
  closeTab: (id: string) => Promise<void>
  setActiveTab: (id: string | null) => void
  _onOutput: (event: { id?: string; data?: string; seq?: number }) => void
  _onExit: (event: { id?: string; exitCode?: number; signal?: number }) => void
}

// ─── Store ───

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  _initialized: false,

  init: () => {
    if (get()._initialized) return
    set({ _initialized: true })

    // Listen for terminal output (handled per-component via ipcClient.on)
    // Listen for terminal exit to update tab status
    ipcClient.on(IPC.TERMINAL_EXIT, (payload) => {
      const event = payload as { id?: string; exitCode?: number; signal?: number }
      get()._onExit(event)
    })
  },

  createTab: async (cwd?: string) => {
    try {
      const result = (await ipcClient.invoke(IPC.TERMINAL_CREATE, {
        cwd,
        cols: 80,
        rows: 24
      })) as {
        id?: string
        shell?: string
        cwd?: string
        title?: string
        createdAt?: number
        error?: string
      }

      if (result.error || !result.id) {
        console.error('[terminal-store] Failed to create terminal:', result.error)
        return null
      }

      const tab: TerminalTab = {
        id: result.id,
        title: result.title || result.shell || 'Terminal',
        shell: result.shell || 'shell',
        cwd: result.cwd || cwd || '~',
        status: 'running',
        createdAt: result.createdAt || Date.now()
      }

      set((state) => ({
        tabs: [...state.tabs, tab],
        activeTabId: tab.id
      }))

      return tab.id
    } catch (error) {
      console.error('[terminal-store] Error creating terminal:', error)
      return null
    }
  },

  closeTab: async (id) => {
    // Kill the terminal session
    try {
      await ipcClient.invoke(IPC.TERMINAL_KILL, { id })
    } catch {
      // ignore
    }

    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== id)
      const activeTabId =
        state.activeTabId === id
          ? tabs.length > 0
            ? tabs[tabs.length - 1].id
            : null
          : state.activeTabId
      return { tabs, activeTabId }
    })
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  _onOutput: (_event) => {
    // Output is handled per-component via ipcClient.on(IPC.TERMINAL_OUTPUT)
  },

  _onExit: (event) => {
    const id = event.id
    if (!id) return

    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              status: event.exitCode === 0 ? 'exited' : 'error',
              exitCode: event.exitCode
            }
          : tab
      )
    }))
  }
}))
