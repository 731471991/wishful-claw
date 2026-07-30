
// ── Cached empty selections (constant references to prevent infinite loops) ──

const EMPTY_TOOL_CALLS: import('./types').ToolCallState[] = []

const EMPTY_SESSION_AGENT_SELECTION = {
  activeSubAgents: {} as Record<string, unknown>,
  completedSubAgents: {} as Record<string, unknown>,
  subAgentHistory: [] as unknown[],
  hasActiveToolCallOutput: false,
  isSessionRunning: false,
  hasOrchestrationData: false,
  signature: 'empty',
  toolCalls: EMPTY_TOOL_CALLS,
}

// Session-scoped cache: key = `${sessionId}\u0000${mode}` → cached selection
const sessionScopedAgentSelectionCache = new Map<string, typeof EMPTY_SESSION_AGENT_SELECTION>()

/**
 * Stub implementation — returns a cached empty selection.
 * The real OpenCowork version tracks sub-agents, tool calls, and orchestration state.
 * TODO: Replace with full implementation when agent orchestration is built.
 */
export function selectSessionScopedAgentState(
  _state: unknown,
  sessionId: string | null | undefined,
  options?: { mode?: string }
): typeof EMPTY_SESSION_AGENT_SELECTION {
  if (!sessionId) return EMPTY_SESSION_AGENT_SELECTION

  const mode = options?.mode ?? 'live'
  const cacheKey = `${sessionId}\u0000${mode}`
  const cached = sessionScopedAgentSelectionCache.get(cacheKey)
  if (cached) return cached

  // Return the shared empty selection (same reference for all sessions)
  sessionScopedAgentSelectionCache.set(cacheKey, EMPTY_SESSION_AGENT_SELECTION)
  return EMPTY_SESSION_AGENT_SELECTION
}

export function findSubAgentInSelection(
  _selection: unknown,
  _toolUseId: string | null | undefined
): import('../../stores/agent-store/types').SubAgentState | null {
  return null
}
