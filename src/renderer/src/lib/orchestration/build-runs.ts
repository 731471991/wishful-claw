import type { OrchestrationRun } from './types'

export interface OrchestrationRunStore {
  runs: OrchestrationRun[]
  byId: Map<string, OrchestrationRun>
  byMessageId: Map<string, { primaryRun: OrchestrationRun | null; hiddenToolUseIds: string[] }>
}

export function buildOrchestrationRuns(_params: Record<string, unknown>): OrchestrationRunStore {
  return { runs: [], byId: new Map(), byMessageId: new Map() }
}
