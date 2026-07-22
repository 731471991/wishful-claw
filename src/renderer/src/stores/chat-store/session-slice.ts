import { nanoid } from 'nanoid'
import type { StateCreator } from 'zustand'
import type { Session, CreateSessionOptions, ChatMessage } from './types'
import { dbCreateSession, dbDeleteSession, dbUpdateSession, dbLoadMessages } from './db-helpers'

export interface SessionSlice {
  sessions: Session[]
  sessionsById: Record<string, number>
  activeSessionId: string | null

  createSession: (
    mode: Session['mode'],
    projectId?: string | null,
    options?: CreateSessionOptions
  ) => string
  deleteSession: (id: string) => void
  setActiveSession: (id: string | null) => void
  updateSessionTitle: (id: string, title: string) => void
  updateSessionIcon: (id: string, icon: string) => void
  updateSessionMode: (id: string, mode: Session['mode']) => void
  setSessionModelManual: (sessionId: string, providerId: string, modelId: string) => void
  setSessionModelAuto: (sessionId: string) => void
  setSessionModelInherit: (sessionId: string) => void
  clearSessionMessages: (sessionId: string) => void
  togglePinSession: (sessionId: string) => void
  duplicateSession: (sessionId: string) => string | null
  restoreSession: (session: Session) => void
  clearAllSessions: () => void

  // Message operations
  addMessage: (sessionId: string, msg: ChatMessage) => void
  beginUserTurn: (
    sessionId: string,
    userMsg: ChatMessage | null,
    assistantMsg: ChatMessage | null,
    streamingMessageId: string | null
  ) => void
  updateMessage: (sessionId: string, msgId: string, patch: Partial<ChatMessage>) => void
  removeMessageById: (sessionId: string, msgId: string) => boolean
  appendTextDelta: (sessionId: string, msgId: string, text: string) => void
  appendThinkingDelta: (sessionId: string, msgId: string, thinking: string) => void
  removeLastAssistantMessage: (sessionId: string) => boolean
  removeLastUserMessage: (sessionId: string) => void
  truncateMessagesFrom: (sessionId: string, fromIndex: number) => void
  replaceSessionMessages: (sessionId: string, messages: ChatMessage[]) => void

  // Helpers
  getActiveSession: () => Session | undefined
  getSessionMessages: (sessionId: string) => ChatMessage[]

  // Message loading (stub - no DB layer yet, messages are in-memory)
  loadRecentSessionMessages: (sessionId: string, force?: boolean, limit?: number) => Promise<void>
  loadOlderSessionMessages: (sessionId: string, limit?: number, options?: { preserveResidentHistory?: boolean }) => Promise<number>
}

function syncSessionsById(state: { sessions: Session[]; sessionsById: Record<string, number> }): void {
  state.sessionsById = {}
  for (let i = 0; i < state.sessions.length; i++) {
    state.sessionsById[state.sessions[i].id] = i
  }
}

function findSessionIndex(sessions: Session[], id: string): number {
  return sessions.findIndex((s) => s.id === id)
}

export const createSessionSlice: StateCreator<SessionSlice, [['zustand/immer', never]], [], SessionSlice> = (set, get) => ({
  sessions: [],
  sessionsById: {},
  activeSessionId: null,

  createSession: (mode, projectId, options) => {
    const id = nanoid()
    const now = Date.now()
    const preserveProjectless = options?.preserveProjectless === true

    let targetProjectId = preserveProjectless
      ? (projectId ?? null)
      : (projectId ?? get()['activeProjectId' as keyof SessionSlice] as string | null ?? null)

    // Try to find a default project if none specified
    if (!targetProjectId && !preserveProjectless) {
      const projects = (get() as unknown as { projects: Array<{ id: string; pluginId?: string }> }).projects
      targetProjectId = projects?.find((p) => !p.pluginId)?.id ?? projects?.[0]?.id ?? null
    }

    const newSession: Session = {
      id,
      title: 'New Conversation',
      mode,
      messages: [],
      messageCount: 0,
      messagesLoaded: true,
      loadedRangeStart: 0,
      loadedRangeEnd: 0,
      lastKnownMessageCount: 0,
      createdAt: now,
      updatedAt: now,
      projectId: targetProjectId ?? undefined,
      workingFolder: options?.workingFolder ?? undefined,
      sshConnectionId: options?.sshConnectionId ?? undefined,
      planId: options?.planId ?? undefined,
      modelSelectionMode: 'inherit'
    }

    set((state) => {
      state.sessions.push(newSession)
      syncSessionsById(state)
      state.activeSessionId = id
    })

    void dbCreateSession(newSession)
    return id
  },

  deleteSession: (id) => {
    set((state) => {
      const idx = findSessionIndex(state.sessions, id)
      if (idx !== -1) {
        state.sessions.splice(idx, 1)
        syncSessionsById(state)
      }
      if (state.activeSessionId === id) {
        state.activeSessionId = state.sessions[0]?.id ?? null
      }
    })
    void dbDeleteSession(id)
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id })
  },

  updateSessionTitle: (id, title) => {
    const now = Date.now()
    set((state) => {
      const session = state.sessions.find((s) => s.id === id)
      if (session) {
        session.title = title
        session.updatedAt = now
      }
    })
    void dbUpdateSession(id, { title, updatedAt: now })
  },

  updateSessionIcon: (id, icon) => {
    const now = Date.now()
    set((state) => {
      const session = state.sessions.find((s) => s.id === id)
      if (session) {
        session.icon = icon
        session.updatedAt = now
      }
    })
    void dbUpdateSession(id, { icon, updatedAt: now })
  },

  updateSessionMode: (id, mode) => {
    const now = Date.now()
    set((state) => {
      const session = state.sessions.find((s) => s.id === id)
      if (session) {
        session.mode = mode
        session.updatedAt = now
      }
    })
    void dbUpdateSession(id, { mode, updatedAt: now })
  },

  clearSessionMessages: (sessionId) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (session) {
        session.messages = []
        session.messageCount = 0
        session.updatedAt = Date.now()
      }
    })
  },

  togglePinSession: (sessionId) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (session) {
        session.pinned = !session.pinned
        session.updatedAt = Date.now()
      }
    })
  },

  duplicateSession: (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId)
    if (!session) return null
    const newId = nanoid()
    const now = Date.now()
    const copy: Session = {
      ...session,
      id: newId,
      title: `${session.title} (copy)`,
      messages: session.messages.map((m) => ({ ...m, id: `${m.id}_copy_${nanoid(6)}` })),
      createdAt: now,
      updatedAt: now,
      pinned: false
    }
    set((state) => {
      state.sessions.push(copy)
      syncSessionsById(state)
      state.activeSessionId = newId
    })
    void dbCreateSession(copy)
    return newId
  },

  restoreSession: (session) => {
    set((state) => {
      const existing = state.sessions.find((s) => s.id === session.id)
      if (existing) {
        Object.assign(existing, session)
      } else {
        state.sessions.push(session)
        syncSessionsById(state)
      }
    })
  },

  clearAllSessions: () => {
    set((state) => {
      state.sessions = []
      state.sessionsById = {}
      state.activeSessionId = null
    })
  },

  addMessage: (sessionId, msg) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (session) {
        session.messages.push(msg)
        session.messageCount = session.messages.length
        session.updatedAt = Date.now()
      }
    })
  },

  beginUserTurn: (sessionId, userMsg, assistantMsg, streamingMessageId) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session) return
      if (userMsg) {
        session.messages.push(userMsg)
      }
      if (assistantMsg) {
        session.messages.push(assistantMsg)
      }
      session.messageCount = session.messages.length
      session.updatedAt = Date.now()
      if (streamingMessageId) {
        ;(state as unknown as { streamingMessages: Record<string, string> }).streamingMessages[sessionId] = streamingMessageId
        ;(state as unknown as { streamingMessageId: string | null }).streamingMessageId = streamingMessageId
      }
    })
  },

  updateMessage: (sessionId, msgId, patch) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session) return
      const msg = session.messages.find((m) => m.id === msgId)
      if (msg) {
        Object.assign(msg, patch)
      }
    })
  },

  removeMessageById: (sessionId, msgId) => {
    let removed = false
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session) return
      const idx = session.messages.findIndex((m) => m.id === msgId)
      if (idx !== -1) {
        session.messages.splice(idx, 1)
        session.messageCount = session.messages.length
        removed = true
      }
    })
    return removed
  },

  appendTextDelta: (sessionId, msgId, text) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session) return
      const msg = session.messages.find((m) => m.id === msgId)
      if (msg) {
        msg.text += text
      }
    })
  },

  appendThinkingDelta: (sessionId, msgId, thinking) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session) return
      const msg = session.messages.find((m) => m.id === msgId)
      if (msg) {
        msg.thinking = (msg.thinking ?? '') + thinking
      }
    })
  },

  removeLastAssistantMessage: (sessionId) => {
    let removed = false
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session) return
      for (let i = session.messages.length - 1; i >= 0; i--) {
        if (session.messages[i].role === 'assistant') {
          session.messages.splice(i, 1)
          session.messageCount = session.messages.length
          removed = true
          break
        }
      }
    })
    return removed
  },

  removeLastUserMessage: (sessionId) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session) return
      for (let i = session.messages.length - 1; i >= 0; i--) {
        if (session.messages[i].role === 'user') {
          session.messages.splice(i, 1)
          session.messageCount = session.messages.length
          break
        }
      }
    })
  },

  truncateMessagesFrom: (sessionId, fromIndex) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session) return
      session.messages = session.messages.slice(0, fromIndex)
      session.messageCount = session.messages.length
    })
  },

  replaceSessionMessages: (sessionId, messages) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session) return
      session.messages = messages
      session.messageCount = messages.length
      session.updatedAt = Date.now()
    })
  },

  setSessionModelManual: (sessionId, providerId, modelId) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session) return
      session.providerId = providerId
      session.modelId = modelId
      session.modelSelectionMode = 'manual'
      session.updatedAt = Date.now()
    })
    const session = get().sessions.find((s) => s.id === sessionId)
    if (session) void dbUpdateSession(sessionId, { providerId, modelId, modelSelectionMode: 'manual' })
  },

  setSessionModelAuto: (sessionId) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session) return
      session.modelSelectionMode = 'auto'
      session.updatedAt = Date.now()
    })
    void dbUpdateSession(sessionId, { modelSelectionMode: 'auto' })
  },

  setSessionModelInherit: (sessionId) => {
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId)
      if (!session) return
      session.modelSelectionMode = 'inherit'
      session.providerId = undefined
      session.modelId = undefined
      session.updatedAt = Date.now()
    })
    void dbUpdateSession(sessionId, { modelSelectionMode: 'inherit', providerId: undefined, modelId: undefined })
  },

  getActiveSession: () => {
    const state = get()
    return state.sessions.find((s) => s.id === state.activeSessionId)
  },

  getSessionMessages: (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId)
    return session?.messages ?? []
  },

  loadRecentSessionMessages: async (sessionId, _force, _limit) => {
    const state = get()
    const session = state.sessions.find((s) => s.id === sessionId)
    if (!session || session.messagesLoaded) return

    try {
      const messages = await dbLoadMessages(sessionId)
      set((state) => {
        const target = state.sessions.find((s) => s.id === sessionId)
        if (!target) return
        target.messages = messages
        target.messageCount = messages.length
        target.messagesLoaded = true
        target.loadedRangeStart = 0
        target.loadedRangeEnd = messages.length
      })
    } catch (err) {
      console.error('[DB] loadRecentSessionMessages failed:', err)
      set((state) => {
        const target = state.sessions.find((s) => s.id === sessionId)
        if (!target) return
        target.messagesLoaded = true
      })
    }
  },

  loadOlderSessionMessages: async (_sessionId, _limit, _options) => {
    // Stub: no DB layer, all messages are already in memory
    return 0
  }
})
