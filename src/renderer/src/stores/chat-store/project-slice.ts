import { nanoid } from 'nanoid'
import type { StateCreator } from 'zustand'
import type { Project } from './types'
import { dbCreateProject, dbDeleteProject, dbUpdateProject } from './db-helpers'
import type { SessionSlice } from './session-slice'

interface ProjectSliceState {
  projects: Project[]
  activeProjectId: string | null

  ensureDefaultProject: () => Promise<Project | null>
  setActiveProject: (id: string | null) => void
  setActiveProjectHome: (id: string | null) => void
  createProject: (input?: Partial<Pick<Project, 'name' | 'workingFolder' | 'sshConnectionId' | 'pluginId'>>) => Promise<string>
  renameProject: (projectId: string, name: string) => void
  deleteProject: (projectId: string) => Promise<void>
  togglePinProject: (projectId: string) => void
  updateProjectDirectory: (projectId: string, patch: Partial<{ workingFolder: string | null; sshConnectionId: string | null }>) => void
}

export type ProjectSlice = ProjectSliceState

export const createProjectSlice: StateCreator<
  SessionSlice & ProjectSliceState,
  [['zustand/immer', never]],
  [],
  ProjectSliceState
> = (set, get) => ({
  projects: [],
  activeProjectId: null,

  ensureDefaultProject: async () => {
    // Check if a default project already exists
    const existing = get().projects.find((p) => !p.pluginId)
    if (existing) {
      if (!get().activeProjectId) {
        set({ activeProjectId: existing.id })
      }
      return existing
    }
    // Create a default project
    const now = Date.now()
    const project: Project = {
      id: nanoid(),
      name: 'Default Project',
      createdAt: now,
      updatedAt: now,
      pinned: false
    }
    set((state) => {
      state.projects.unshift(project)
      if (!state.activeProjectId) {
        state.activeProjectId = project.id
      }
    })
    void dbCreateProject(project)
    return project
  },

  setActiveProject: (id) => {
    set((state) => {
      state.activeProjectId = id
      if (!id) {
        state.activeSessionId = null
        return
      }
      // Find the most recent session in this project
      const sessionsInProject = state.sessions
        .filter((s) => s.projectId === id)
        .sort((a, b) => b.updatedAt - a.updatedAt)
      const nextSessionId = sessionsInProject[0]?.id ?? null
      if (nextSessionId) {
        state.activeSessionId = nextSessionId
      }
    })
  },

  setActiveProjectHome: (id) => {
    set((state) => {
      state.activeProjectId = id
      state.activeSessionId = null
    })
  },

  createProject: async (input) => {
    const now = Date.now()
    const project: Project = {
      id: nanoid(),
      name: input?.name ?? 'New Project',
      createdAt: now,
      updatedAt: now,
      workingFolder: input?.workingFolder ?? undefined,
      sshConnectionId: input?.sshConnectionId ?? undefined,
      pluginId: input?.pluginId,
      pinned: false
    }
    set((state) => {
      state.projects.unshift(project)
      state.activeProjectId = project.id
    })
    void dbCreateProject(project)
    return project.id
  },

  renameProject: (projectId, name) => {
    const nextName = name.trim()
    if (!nextName) return
    const now = Date.now()
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId)
      if (project) {
        project.name = nextName
        project.updatedAt = now
      }
    })
    void dbUpdateProject(projectId, { name: nextName, updatedAt: now })
  },

  deleteProject: async (projectId) => {
    set((state) => {
      state.projects = state.projects.filter((p) => p.id !== projectId)
      // Delete all sessions in this project
      const deletedSessionIds = new Set(
        state.sessions.filter((s) => s.projectId === projectId).map((s) => s.id)
      )
      state.sessions = state.sessions.filter((s) => !deletedSessionIds.has(s.id))
      // Rebuild sessionsById
      state.sessionsById = {}
      for (let i = 0; i < state.sessions.length; i++) {
        state.sessionsById[state.sessions[i].id] = i
      }
      // Update active IDs
      if (state.activeProjectId === projectId) {
        state.activeProjectId = state.projects[0]?.id ?? null
      }
      if (state.activeSessionId && !state.sessions.some((s) => s.id === state.activeSessionId)) {
        state.activeSessionId = state.sessions[0]?.id ?? null
      }
    })
    void dbDeleteProject(projectId)
  },

  togglePinProject: (projectId) => {
    const now = Date.now()
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId)
      if (project) {
        project.pinned = !project.pinned
        project.updatedAt = now
      }
    })
    void dbUpdateProject(projectId, { updatedAt: now })
  },

  updateProjectDirectory: (projectId, patch) => {
    const now = Date.now()
    set((state) => {
      const project = state.projects.find((p) => p.id === projectId)
      if (!project) return
      if (patch.workingFolder !== undefined) {
        project.workingFolder = patch.workingFolder ?? undefined
      }
      if (patch.sshConnectionId !== undefined) {
        project.sshConnectionId = patch.sshConnectionId ?? undefined
      }
      project.updatedAt = now
    })
    void dbUpdateProject(projectId, { updatedAt: now })
  }
})
