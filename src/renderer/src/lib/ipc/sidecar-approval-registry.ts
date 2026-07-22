import type { SidecarApprovalRequest } from './sidecar-protocol'

export interface SidecarApprovalDecision {
  approved: boolean
  reason?: string
}

export type SidecarApprovalHandler = (
  request: SidecarApprovalRequest
) =>
  | Promise<SidecarApprovalDecision | null | undefined>
  | SidecarApprovalDecision
  | null
  | undefined

const runApprovalHandlers = new Map<string, SidecarApprovalHandler>()

export function registerSidecarApprovalHandler(
  runId: string,
  handler: SidecarApprovalHandler
): () => void {
  runApprovalHandlers.set(runId, handler)
  return () => {
    if (runApprovalHandlers.get(runId) === handler) {
      runApprovalHandlers.delete(runId)
    }
  }
}

export async function resolveSidecarApprovalRequest(
  request: SidecarApprovalRequest
): Promise<SidecarApprovalDecision | null> {
  if (!request.runId) return null

  const handler = runApprovalHandlers.get(request.runId)
  if (!handler) return null

  return (await handler(request)) ?? null
}
