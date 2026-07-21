import type { ToolDefinition } from '../../api/types'
import type { SubAgentDefinition } from './types'

export interface ResolvedSubAgentTools {
  tools: ToolDefinition[]
  invalidTools: string[]
}

export function resolveSubAgentTools(
  _definition: Pick<SubAgentDefinition, 'tools' | 'disallowedTools'>,
  allTools: ToolDefinition[]
): ResolvedSubAgentTools {
  return {
    tools: [...allTools],
    invalidTools: []
  }
}
