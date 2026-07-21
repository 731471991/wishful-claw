import type { UnifiedMessage } from '@renderer/lib/api/types'

export function selectSessionScopedAgentState(_messages: UnifiedMessage[]): {
  toolCalls: import('@renderer/lib/agent/types').ToolCallState[]
} {
  return { toolCalls: [] }
}

export function findSubAgentInSelection(_messages: UnifiedMessage[], _toolUseId: string): unknown {
  return null
}
