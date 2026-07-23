import type { StateCreator } from 'zustand'
import type { AgentStore, AgentRunChangeSet } from '../types'
import { invokeMessagePackBinary } from '../../../lib/ipc/messagepack-ipc-client'
import { IPC } from '../../../lib/ipc/channels'
import { toMessagePackChannel } from '../../../../../shared/messagepack/binary-ipc'
import {
  isAgentChangeError,
  trimRunChangesMap,
  cacheRunChangeSet,
  clearSessionRunChangeCache,
  sessionRunChangeRefreshInFlight
} from '../utils/change-set-utils'

type Slice = StateCreator<
  AgentStore,
  [['zustand/immer', never], ['zustand/persist', unknown]],
  [],
  Pick<AgentStore, 'refreshRunChanges' | 'refreshSessionRunChanges' | 'undoRunChanges' | 'undoFileChange'>
>

export const createRunChangesSlice: Slice = (set, get) => ({
      refreshRunChanges: async (runId, query) => {
        if (!runId) return
        const sessionId = query?.sessionId?.trim()
        if (!sessionId) return
        await get().refreshSessionRunChanges(sessionId)
      },
      refreshSessionRunChanges: async (sessionId) => {
        if (!sessionId) return
        const inFlight = sessionRunChangeRefreshInFlight.get(sessionId)
        if (inFlight) return inFlight
        const request = (async () => {
          try {
            const result = await invokeMessagePackBinary(
              toMessagePackChannel(IPC.AGENT_CHANGES_LIST_SESSION),
              { sessionId }
            )
            if (isAgentChangeError(result) || !Array.isArray(result)) return
            set((state) => {
              clearSessionRunChangeCache(state.runChangesByRunId, sessionId)
              for (const item of result) {
                if (!item || typeof item !== 'object' || !('runId' in item)) continue
                const changeSet = item as AgentRunChangeSet
                cacheRunChangeSet(state.runChangesByRunId, changeSet)
              }
              trimRunChangesMap(state.runChangesByRunId)
            })
          } catch {
            // ignore fetch failures for ephemeral change journal state
          } finally {
            sessionRunChangeRefreshInFlight.delete(sessionId)
          }
        })()
        sessionRunChangeRefreshInFlight.set(sessionId, request)
        return request
      },
      undoRunChanges: async (runId) => {
        if (!runId) return { error: 'runId is required' }
        try {
          const result = await invokeMessagePackBinary(
            toMessagePackChannel(IPC.AGENT_CHANGES_UNDO_RUN),
            { runId }
          )
          if (isAgentChangeError(result)) return { error: result.error }
          const changeset =
            result && typeof result === 'object' && 'changeset' in result
              ? (result as { changeset?: AgentRunChangeSet }).changeset
              : undefined
          set((state) => {
            if (changeset) {
              cacheRunChangeSet(state.runChangesByRunId, changeset, runId)
              trimRunChangesMap(state.runChangesByRunId)
            }
          })
          return {}
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) }
        }
      },
      undoFileChange: async (runId, changeId) => {
        if (!runId || !changeId) return { error: 'runId and changeId are required' }
        try {
          const result = await invokeMessagePackBinary(
            toMessagePackChannel(IPC.AGENT_CHANGES_UNDO_FILE),
            {
              runId,
              changeId
            }
          )
          if (isAgentChangeError(result)) return { error: result.error }
          const changeset =
            result && typeof result === 'object' && 'changeset' in result
              ? (result as { changeset?: AgentRunChangeSet }).changeset
              : undefined
          set((state) => {
            if (changeset) {
              cacheRunChangeSet(state.runChangesByRunId, changeset, runId)
              trimRunChangesMap(state.runChangesByRunId)
            }
          })
          return {}
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) }
        }
      },
})
