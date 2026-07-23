
import type { ToolCallState } from '../../../lib/agent/types'
import {
  normalizeToolCall,
  normalizeToolCallPatch,
  toolCallPatchHasChanges,
  trimToolCallArray
} from './tool-call-utils'

export function applyToolCallToBuckets(
  pending: ToolCallState[],
  executed: ToolCallState[],
  tc: ToolCallState
): void {
  const normalizedTc = normalizeToolCall(tc)
  const execIdx = executed.findIndex((item) => item.id === normalizedTc.id)
  if (execIdx !== -1) {
    if (normalizedTc.status === 'pending_approval') {
      const [moved] = executed.splice(execIdx, 1)
      Object.assign(moved, normalizedTc)
      pending.push(moved)
    } else {
      Object.assign(executed[execIdx], normalizedTc)
    }
    trimToolCallArray(executed)
    trimToolCallArray(pending)
    return
  }

  const pendingIdx = pending.findIndex((item) => item.id === normalizedTc.id)
  if (pendingIdx !== -1) {
    if (normalizedTc.status !== 'pending_approval') {
      const [moved] = pending.splice(pendingIdx, 1)
      Object.assign(moved, normalizedTc)
      executed.push(moved)
    } else {
      Object.assign(pending[pendingIdx], normalizedTc)
    }
    trimToolCallArray(executed)
    trimToolCallArray(pending)
    return
  }

  if (normalizedTc.status === 'pending_approval') {
    pending.push(normalizedTc)
  } else {
    executed.push(normalizedTc)
  }
  trimToolCallArray(executed)
  trimToolCallArray(pending)
}

export function applyToolCallPatchToBuckets(
  pending: ToolCallState[],
  executed: ToolCallState[],
  id: string,
  patch: Partial<ToolCallState>
): boolean {
  const pendingToolCall = pending.find((item) => item.id === id)
  const executedToolCall = executed.find((item) => item.id === id)
  const normalizedPatch = normalizeToolCallPatch(
    patch,
    pendingToolCall?.name ?? executedToolCall?.name
  )
  if (pendingToolCall) {
    if (!toolCallPatchHasChanges(pendingToolCall, normalizedPatch)) return false
    Object.assign(pendingToolCall, normalizedPatch)
    if (normalizedPatch.status && normalizedPatch.status !== 'pending_approval') {
      const index = pending.findIndex((item) => item.id === id)
      if (index !== -1) {
        const [moved] = pending.splice(index, 1)
        executed.push(moved)
      }
    }
    trimToolCallArray(executed)
    trimToolCallArray(pending)
    return true
  }

  if (executedToolCall) {
    if (!toolCallPatchHasChanges(executedToolCall, normalizedPatch)) return false
    Object.assign(executedToolCall, normalizedPatch)
    trimToolCallArray(executed)
    return true
  }

  return false
}

export function resolveApprovalInBuckets(
  pending: ToolCallState[],
  executed: ToolCallState[],
  toolCallId: string,
  approved: boolean
): boolean {
  const idx = pending.findIndex((toolCall) => toolCall.id === toolCallId)
  if (idx === -1) return false

  const [moved] = pending.splice(idx, 1)
  moved.status = approved ? 'running' : 'error'
  if (approved) {
    delete moved.error
  } else {
    moved.error = 'User denied permission'
  }
  executed.push(normalizeToolCall(moved))
  trimToolCallArray(executed)
  trimToolCallArray(pending)
  return true
}

export function rejectPendingApprovalsInBuckets(
  pending: ToolCallState[],
  executed: ToolCallState[],
  error: string
): void {
  if (pending.length === 0) return

  for (const tc of pending) {
    tc.status = 'error'
    tc.error = error
    executed.push(normalizeToolCall(tc))
  }
  pending.splice(0, pending.length)
  trimToolCallArray(executed)
}
