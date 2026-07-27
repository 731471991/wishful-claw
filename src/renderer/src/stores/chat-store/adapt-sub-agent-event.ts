import type { SubAgentEvent } from '@renderer/lib/agent/sub-agents/types'
import type { UnifiedMessage } from '@renderer/lib/api/types'
import type { ToolCallState } from '@renderer/lib/agent/types'

/**
 * Adapt backend sub-agent stream events to the SubAgentEvent shape expected by the store.
 * The backend emits sub_agent_start and sub_agent_end with a simpler structure;
 * we fill in the gaps (promptMessage, usage) with sensible defaults.
 */
export function adaptSubAgentEvent(
  event: Record<string, unknown>
): SubAgentEvent | null {
  const type = event.type as string
  const subAgentName = (event.subAgentName as string) ?? 'unknown'
  const toolUseId = (event.toolUseId as string) ?? ''
  if (!toolUseId) return null

  switch (type) {
    case 'sub_agent_start': {
      const input = (event.input as Record<string, unknown>) ?? {}
      const promptText = String(input.prompt ?? input.query ?? input.task ?? '')
      return {
        type: 'sub_agent_start',
        subAgentName,
        toolUseId,
        input,
        promptMessage: {
          id: `subagent_prompt_${toolUseId}`,
          role: 'user',
          content: promptText,
          createdAt: Date.now()
        }
      }
    }
    case 'sub_agent_end': {
      const rawResult = (event.result as Record<string, unknown>) ?? {}
      const output = String(rawResult.output ?? '')
      const success = rawResult.success === true
      const stopReason = String(rawResult.stopReason ?? 'completed')
      const toolCallCount = Number(rawResult.toolCallCount ?? 0)
      const iterations = Number(rawResult.iterations ?? 0)
      return {
        type: 'sub_agent_end',
        subAgentName,
        toolUseId,
        result: {
          success,
          output,
          reportSubmitted: output.length > 0,
          toolCallCount,
          iterations,
          endReason: stopReason === 'completed' ? 'completed' : stopReason === 'max_iterations' ? 'max_iterations' : 'error',
          usage: {
            inputTokens: 0,
            outputTokens: 0
          },
          ...(output.length === 0 ? { error: 'No output' } : {})
        }
      }
    }
    case 'sub_agent_text_delta': {
      return {
        type: 'sub_agent_text_delta',
        subAgentName,
        toolUseId,
        text: String(event.text ?? '')
      }
    }
    case 'sub_agent_iteration': {
      return {
        type: 'sub_agent_iteration',
        subAgentName,
        toolUseId,
        iteration: Number(event.iteration ?? 0),
        assistantMessage: (event.assistantMessage as unknown as UnifiedMessage) ?? {
          id: `subagent_iter_${toolUseId}_${Number(event.iteration ?? 0)}`,
          role: 'assistant' as const,
          content: [],
          createdAt: Date.now()
        }
      }
    }
    case 'sub_agent_thinking_delta': {
      return {
        type: 'sub_agent_thinking_delta',
        subAgentName,
        toolUseId,
        thinking: String(event.thinking ?? '')
      }
    }
    case 'sub_agent_tool_call': {
      return {
        type: 'sub_agent_tool_call',
        subAgentName,
        toolUseId,
        toolCall: event.toolCall as unknown as ToolCallState
      }
    }
    case 'sub_agent_report_update': {
      return {
        type: 'sub_agent_report_update',
        subAgentName,
        toolUseId,
        report: String(event.report ?? ''),
        status: (event.status as 'pending' | 'submitted' | 'missing') ?? 'pending'
      }
    }
    default:
      return null
  }
}
