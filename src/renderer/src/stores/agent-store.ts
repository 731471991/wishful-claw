import { create } from 'zustand'

export interface AgentRunFileChange {
  path: string
  status: 'added' | 'modified' | 'deleted'
  additions?: number
  deletions?: number
}

export interface AgentRunChangeSet {
  runId: string
  changes: AgentRunFileChange[]
}

interface AgentStore {
  changesByRunId: Record<string, AgentRunChangeSet>
  setRunChangeSet: (runId: string, changeset: AgentRunChangeSet) => void
  getRunChangeSet: (runId: string) => AgentRunChangeSet | undefined
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  changesByRunId: {},
  setRunChangeSet: (runId, changeset) =>
    set((state) => ({
      changesByRunId: { ...state.changesByRunId, [runId]: changeset }
    })),
  getRunChangeSet: (runId) => get().changesByRunId[runId]
}))
