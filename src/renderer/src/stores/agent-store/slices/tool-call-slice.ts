import type { StateCreator } from 'zustand'
import type { AgentStore } from '../types'
import { emitAgentRuntimeSync, isAgentRuntimeSyncSuppressed } from '../../../lib/agent-runtime-sync'
import { sendApprovalResponse, sendPlanApprovalResponse } from '../../../lib/agent/teams/inbox-poller'
import { approvalResolvers, approvalMetadata } from '../approval-resolvers'
import { resolveSessionToolCallTarget } from '../utils/change-set-utils'
import {
  applyToolCallToBuckets,
  applyToolCallPatchToBuckets,
  resolveApprovalInBuckets,
  rejectPendingApprovalsInBuckets
} from '../utils/tool-call-buckets'

type Slice = StateCreator<
  AgentStore,
  [['zustand/immer', never], ['zustand/persist', unknown]],
  [],
  Pick<AgentStore, 'addToolCall' | 'updateToolCall' | 'addApprovedTool' | 'requestApproval' | 'registerApprovalSource' | 'resolveApproval' | 'clearPendingApprovals'>
>

export const createToolCallSlice: Slice = (set, get) => ({
      addToolCall: (tc, sessionId) => {
        const resolvedSessionId = sessionId ?? tc.sessionId ?? get().liveSessionId
        set((state) => {
          const target = resolveSessionToolCallTarget(state, resolvedSessionId)
          applyToolCallToBuckets(target.pending, target.executed, {
            ...tc,
            ...(resolvedSessionId ? { sessionId: resolvedSessionId } : {})
          })
        })
        if (!isAgentRuntimeSyncSuppressed()) {
          emitAgentRuntimeSync({
            kind: 'add_tool_call',
            toolCall: tc,
            sessionId: resolvedSessionId
          })
        }
      },
      updateToolCall: (id, patch, sessionId) => {
        let changed = false
        let resolvedSessionId = sessionId ?? patch.sessionId ?? get().liveSessionId ?? null
        set((state) => {
          const explicitSessionId = sessionId ?? patch.sessionId ?? null
          if (explicitSessionId) {
            const target = resolveSessionToolCallTarget(state, explicitSessionId)
            if (applyToolCallPatchToBuckets(target.pending, target.executed, id, patch)) {
              changed = true
              resolvedSessionId = explicitSessionId
              return
            }
          }

          if (
            applyToolCallPatchToBuckets(state.pendingToolCalls, state.executedToolCalls, id, patch)
          ) {
            changed = true
            resolvedSessionId = state.liveSessionId
            return
          }

          for (const [cacheSessionId, cache] of Object.entries(state.sessionToolCallsCache)) {
            if (applyToolCallPatchToBuckets(cache.pending, cache.executed, id, patch)) {
              changed = true
              resolvedSessionId = cacheSessionId
              return
            }
          }
        })
        if (changed && !isAgentRuntimeSyncSuppressed()) {
          emitAgentRuntimeSync({
            kind: 'update_tool_call',
            id,
            patch,
            sessionId: resolvedSessionId
          })
        }
      },
      addApprovedTool: (name) => {
        set((state) => {
          if (!state.approvedToolNames.includes(name)) {
            state.approvedToolNames.push(name)
          }
        })
      },
      requestApproval: (toolCallId) => {
        return new Promise<boolean>((resolve) => {
          approvalResolvers.set(toolCallId, resolve)
        })
      },
      registerApprovalSource: (toolCallId, meta) => {
        approvalMetadata.set(toolCallId, {
          requestId: meta.requestId,
          replyTo: meta.replyTo,
          source: meta.source ?? 'teammate'
        })
      },
      clearPendingApprovals: () => {
        for (const [, resolve] of approvalResolvers) {
          resolve(false)
        }
        approvalResolvers.clear()
        approvalMetadata.clear()
        set((state) => {
          rejectPendingApprovalsInBuckets(
            state.pendingToolCalls,
            state.executedToolCalls,
            'Aborted (team deleted)'
          )
          for (const cache of Object.values(state.sessionToolCallsCache)) {
            if (!cache) continue
            rejectPendingApprovalsInBuckets(cache.pending, cache.executed, 'Aborted (team deleted)')
          }
        })
        if (!isAgentRuntimeSyncSuppressed()) {
          emitAgentRuntimeSync({ kind: 'clear_pending_approvals' })
        }
      },
      resolveApproval: (toolCallId, approved) => {
        const resolve = approvalResolvers.get(toolCallId)
        if (resolve) {
          resolve(approved)
          approvalResolvers.delete(toolCallId)
        }

        const meta = approvalMetadata.get(toolCallId)
        if (meta?.source === 'teammate') {
          void sendApprovalResponse({
            requestId: meta.requestId,
            approved,
            to: meta.replyTo,
            summary: approved ? 'Leader approved tool use' : 'Leader denied tool use'
          }).catch((error) => {
            console.error('[TeamRuntime] Failed to send approval response:', error)
          })
          approvalMetadata.delete(toolCallId)
        } else if (meta?.source === 'teammate-plan') {
          void sendPlanApprovalResponse({
            requestId: meta.requestId,
            approved,
            to: meta.replyTo,
            feedback: approved ? 'Leader approved plan' : 'Leader rejected plan'
          }).catch((error) => {
            console.error('[TeamRuntime] Failed to send plan approval response:', error)
          })
          approvalMetadata.delete(toolCallId)
        }

        set((state) => {
          if (
            resolveApprovalInBuckets(
              state.pendingToolCalls,
              state.executedToolCalls,
              toolCallId,
              approved
            )
          ) {
            return
          }

          for (const cache of Object.values(state.sessionToolCallsCache)) {
            if (!cache) continue
            if (resolveApprovalInBuckets(cache.pending, cache.executed, toolCallId, approved)) {
              return
            }
          }
        })
        if (!isAgentRuntimeSyncSuppressed()) {
          emitAgentRuntimeSync({ kind: 'resolve_approval', toolCallId, approved })
        }
      }
})
