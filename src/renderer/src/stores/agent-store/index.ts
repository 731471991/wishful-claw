import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, createJSONStorage } from 'zustand/middleware'
import { ipcStorage } from '../../lib/ipc/ipc-storage'
import type { AgentStore } from './types'
import { AGENT_STORE_STORAGE_KEY } from './constants'
import { initAgentHistoryHydration, setAgentHistoryHydrationPromise } from './sub-agent-persistence'
import { createSessionSlice } from './slices/session-slice'
import { createToolCallSlice } from './slices/tool-call-slice'
import { createBackgroundProcessSlice } from './slices/background-process-slice'
import { createRunChangesSlice } from './slices/run-changes-slice'
import { createSubAgentSlice } from './slices/sub-agent-slice'

// Re-exports for backward compatibility
export type {
  SubAgentState,
  BackgroundProcessState,
  ForegroundShellExecState,
  AgentRunChangeSet,
  AgentRunFileChange,
  AgentFileSnapshot,
  AgentStore
} from './types'

export const useAgentStore = create<AgentStore>()(
  persist(
    immer((...args) => ({
      // Initial state
      isRunning: false,
      currentLoopId: null,
      liveSessionId: null,
      pendingToolCalls: [],
      executedToolCalls: [],
      runChangesByRunId: {},
      runningSessions: {},
      sessionRequestRetryState: {},
      sessionToolCallsCache: {},
      sessionSubAgentLiveCache: {},
      activeSubAgents: {},
      completedSubAgents: {},
      subAgentHistory: [],
      runningSubAgentNamesSig: '',
      runningSubAgentSessionIdsSig: '',
      approvedToolNames: [],
      sessionSubAgentSummaries: {},
      sessionBackgroundProcessSummaries: {},
      backgroundProcesses: {},
      foregroundShellExecByToolUseId: {},

      // Slices
      ...createSessionSlice(...args),
      ...createToolCallSlice(...args),
      ...createBackgroundProcessSlice(...args),
      ...createRunChangesSlice(...args),
      ...createSubAgentSlice(...args),
    })),
    {
      name: AGENT_STORE_STORAGE_KEY,
      storage: createJSONStorage(() => ipcStorage),
      merge: (persisted, current) => {
        const record =
          persisted && typeof persisted === 'object' ? (persisted as Partial<AgentStore>) : {}
        return {
          ...current,
          approvedToolNames: Array.isArray(record.approvedToolNames)
            ? record.approvedToolNames.filter((name): name is string => typeof name === 'string')
            : current.approvedToolNames
        }
      },
      partialize: (state) => ({
        approvedToolNames: state.approvedToolNames
      }),
      onRehydrateStorage: () => () => {}
    }
  )
)

// Start hydration
setAgentHistoryHydrationPromise(initAgentHistoryHydration())
