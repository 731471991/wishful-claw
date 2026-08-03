import { create } from 'zustand'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'
import { useUIStore } from '@renderer/stores/ui-store'

// ─── Types ───

export type TerminalTabKind = 'local' | 'ssh-agent'

export interface TerminalTab {
  id: string
  kind: TerminalTabKind
  title: string
  shell: string
  cwd: string
  status: 'running' | 'exited' | 'error'
  exitCode?: number
  createdAt: number
  /** For ssh-agent tabs: the tool call execId used to correlate ssh:exec-output events */
  execId?: string
  /** For ssh-agent tabs: the connection name for display */
  connectionName?: string
}

interface TerminalStore {
  tabs: TerminalTab[]
  activeTabId: string | null
  _initialized: boolean

  init: () => void
  createTab: (cwd?: string) => Promise<string | null>
  closeTab: (id: string) => Promise<void>
  setActiveTab: (id: string | null) => void

  /** Create a read-only SSH agent observation tab */
  createSshAgentTab: (execId: string, connectionName?: string) => void
  /** Mark an SSH agent tab as completed */
  completeSshAgentTab: (execId: string, exitCode: number) => void
  /** Check if a tab with the given execId exists */
  hasSshAgentTab: (execId: string) => boolean

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

    // Listen for SSH exec output to auto-create agent tabs
    ipcClient.on(IPC.SSH_EXEC_OUTPUT, (payload) => {
      const event = payload as { execId?: string; stream?: string; data?: string }
      if (!event.execId) return

      // Auto-create a tab for this execId if it doesn't exist yet
      if (!get().hasSshAgentTab(event.execId)) {
        get().createSshAgentTab(event.execId)
      }
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
        kind: 'local',
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
    const tab = get().tabs.find((t) => t.id === id)

    // Only kill node-pty sessions for local tabs
    if (tab?.kind !== 'ssh-agent') {
      try {
        await ipcClient.invoke(IPC.TERMINAL_KILL, { id })
      } catch {
        // ignore
      }
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

  createSshAgentTab: (execId, connectionName) => {
    // Don't create duplicate tabs for the same execId
    if (get().hasSshAgentTab(execId)) return

    const tab: TerminalTab = {
      id: `ssh-agent-${execId}`,
      kind: 'ssh-agent',
      title: connectionName ? `SSH: ${connectionName}` : 'Agent SSH',
      shell: 'ssh',
      cwd: '~',
      status: 'running',
      createdAt: Date.now(),
      execId,
      connectionName
    }

    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id
    }))

    // Auto-open the right panel and switch to terminal tab so user can see the output
    useUIStore.getState().ensureTerminalTab()
  },

  completeSshAgentTab: (execId, exitCode) => {
    const tabId = `ssh-agent-${execId}`
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              status: exitCode === 0 ? 'exited' : 'error',
              exitCode
            }
          : tab
      )
    }))
  },

  hasSshAgentTab: (execId) => {
    return get().tabs.some((t) => t.id === `ssh-agent-${execId}`)
  },

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
