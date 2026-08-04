import { create } from 'zustand'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'
import { useUIStore } from '@renderer/stores/ui-store'
import { useChatStore } from '@renderer/stores/chat-store'

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
  /** Project this tab belongs to (for filtering in the bottom dock) */
  projectId?: string | null
  /** For ssh-agent tabs: the connection name for display */
  connectionName?: string
}

interface TerminalStore {
  tabs: TerminalTab[]
  activeTabId: string | null
  _initialized: boolean

  init: () => void
  createTab: (cwd?: string, projectId?: string | null, titleOverride?: string) => Promise<string | null>
  closeTab: (id: string) => Promise<void>
  setActiveTab: (id: string | null) => void

  /** Create or reuse an SSH agent observation tab for a project */
  ensureSshAgentTab: (projectId: string, connectionName?: string) => void
  /** Check if an agent tab exists for a project */
  hasSshAgentTabForProject: (projectId: string) => boolean

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

    // Listen for terminal exit to update tab status
    ipcClient.on(IPC.TERMINAL_EXIT, (payload) => {
      const event = payload as { id?: string; exitCode?: number; signal?: number }
      get()._onExit(event)
    })

    // Listen for SSH exec output — ensure a single agent tab per project
    ipcClient.on(IPC.SSH_EXEC_OUTPUT, (payload) => {
      const event = payload as { execId?: string; stream?: string; data?: string }
      if (!event.execId) return

      // Look up the active project ID
      const chatState = useChatStore.getState()
      const activeSession = chatState.sessions.find(
        (s: any) => s.id === chatState.activeSessionId
      )
      const projectId = activeSession?.projectId ?? null

      if (!projectId) return

      // Create a tab for this project if one doesn't exist yet
      // (reuses the same tab for all subsequent commands)
      if (!get().hasSshAgentTabForProject(projectId)) {
        const project = chatState.projects.find((p: any) => p.id === projectId)
        get().ensureSshAgentTab(projectId, project?.name)
      }
    })
  },

  createTab: async (cwd, projectId, titleOverride) => {
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
        title: titleOverride || result.title || result.shell || 'Terminal',
        shell: result.shell || 'shell',
        cwd: result.cwd || cwd || '~',
        status: 'running',
        createdAt: result.createdAt || Date.now(),
        projectId: projectId ?? null
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

  ensureSshAgentTab: (projectId, connectionName) => {
    // Reuse existing tab for this project — one agent tab per project
    const existing = get().tabs.find(
      (t) => t.kind === 'ssh-agent' && t.projectId === projectId
    )
    if (existing) {
      // Make it active
      set({ activeTabId: existing.id })
      return
    }

    const tab: TerminalTab = {
      id: `ssh-agent-${projectId}`,
      kind: 'ssh-agent',
      title: connectionName ? `Agent: ${connectionName}` : 'Agent SSH',
      shell: 'ssh',
      cwd: '~',
      status: 'running',
      createdAt: Date.now(),
      connectionName,
      projectId
    }

    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id
    }))

    // Auto-open the bottom terminal dock
    useUIStore.getState().setBottomTerminalDockOpen(projectId, true)
  },

  hasSshAgentTabForProject: (projectId) => {
    return get().tabs.some(
      (t) => t.kind === 'ssh-agent' && t.projectId === projectId
    )
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
