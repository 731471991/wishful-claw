/**
 * Sub-agent tool approval handler.
 *
 * When a sub-agent executes a tool that requires approval (Write, Edit, Bash, etc.),
 * the Worker sends a reverse-request via the renderer tool bridge. This module
 * registers a pending approval promise and returns it. The SubAgentCard UI
 * renders approve/reject buttons, and resolving the promise sends the response
 * back to the Worker.
 */

const pendingApprovals = new Map<
  string,
  { resolve: (approved: boolean) => void; toolName: string; input: Record<string, unknown> }
>()

export interface SubAgentApprovalRequest {
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
}

export interface SubAgentApprovalResponse {
  approved: boolean
}

/**
 * Called by the renderer tool bridge when a sub-agent:approve-tool
 * reverse-request arrives. Returns a promise that resolves when the
 * user clicks approve/reject in the SubAgentCard UI.
 */
export async function handleSubAgentApprovalRequest(
  params: unknown
): Promise<SubAgentApprovalResponse> {
  const record = isRecord(params) ? params : {}
  const toolCallId =
    typeof record.toolCallId === 'string' ? record.toolCallId.trim() : ''
  const toolName = typeof record.toolName === 'string' ? record.toolName.trim() : ''
  const input = isRecord(record.input) ? record.input : {}

  if (!toolCallId) {
    return { approved: false }
  }

  return new Promise<SubAgentApprovalResponse>((resolve) => {
    pendingApprovals.set(toolCallId, {
      resolve: (approved: boolean) => resolve({ approved }),
      toolName,
      input
    })

    // Auto-reject after 5 minutes to prevent infinite hangs
    setTimeout(() => {
      if (pendingApprovals.has(toolCallId)) {
        pendingApprovals.delete(toolCallId)
        resolve({ approved: false })
      }
    }, 300_000)
  })
}

/**
 * Returns all pending approval requests for UI rendering.
 */
export function getPendingApprovals(): SubAgentApprovalRequest[] {
  return Array.from(pendingApprovals.entries()).map(([toolCallId, { toolName, input }]) => ({
    toolCallId,
    toolName,
    input
  }))
}

/**
 * Returns a specific pending approval by toolCallId, or null if not pending.
 */
export function getPendingApproval(toolCallId: string): SubAgentApprovalRequest | null {
  const entry = pendingApprovals.get(toolCallId)
  if (!entry) return null
  return { toolCallId, toolName: entry.toolName, input: entry.input }
}

/**
 * Resolves a pending approval. Called by SubAgentCard when user clicks
 * approve or reject.
 */
export function resolveSubAgentApproval(toolCallId: string, approved: boolean): void {
  const entry = pendingApprovals.get(toolCallId)
  if (entry) {
    pendingApprovals.delete(toolCallId)
    entry.resolve(approved)
  }
}

/**
 * Cancels all pending approvals (e.g. when session is closed).
 */
export function cancelAllPendingApprovals(): void {
  for (const [, entry] of pendingApprovals) {
    entry.resolve(false)
  }
  pendingApprovals.clear()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
