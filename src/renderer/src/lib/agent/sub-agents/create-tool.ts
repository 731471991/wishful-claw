import type { ProviderConfig, TokenUsage } from '../../api/types'
import { encodeStructuredToolResult } from '../../tools/tool-result-format'
import type { ToolHandler } from '../../tools/tool-types'

export interface SubAgentMeta {
  iterations: number
  elapsed: number
  usage: TokenUsage
  toolCalls: Array<{
    id: string
    name: string
    input: Record<string, unknown>
    status: string
    output?: string
    error?: string
    startedAt?: number
    completedAt?: number
  }>
}

const META_PREFIX = '<!--subagent-meta:'
const META_SUFFIX = '-->\n'

export function parseSubAgentMeta(output: string): { meta: SubAgentMeta | null; text: string } {
  if (!output.startsWith(META_PREFIX)) return { meta: null, text: output }
  const endIdx = output.indexOf(META_SUFFIX)
  if (endIdx < 0) return { meta: null, text: output }
  try {
    const json = output.slice(META_PREFIX.length, endIdx)
    const meta = JSON.parse(json) as SubAgentMeta
    const text = output.slice(endIdx + META_SUFFIX.length)
    return { meta, text }
  } catch {
    return { meta: null, text: output }
  }
}

export const TASK_TOOL_NAME = 'Task'
export const CUSTOM_SUBAGENT_TYPE = 'custom'

export function clearLastTaskInvocation(_sessionId: string | undefined | null): void {
  // Native AgentRuntime owns Task de-duplication state.
}

export function removeTeamLimiter(_teamName: string): void {
  // Native AgentRuntime owns teammate scheduling state.
}

function nativeOnlyTaskResult(): string {
  return encodeStructuredToolResult({
    error: 'Task execution has migrated to the .NET Native Worker.'
  })
}

const TASK_DESCRIPTION = `Launch a sub-agent to handle a complex, multi-step task autonomously.

The sub-agent runs in its own session with a general-purpose system prompt and inherits the parent agent's complete tool set. Only its final answer is returned to you — the parent must relay a summary to the user.

When to use Task:
- Multi-file investigation or research that would clutter your context
- Focused sub-tasks that benefit from isolation (e.g. "verify this function works", "find all usages of X")
- Parallel work — send multiple Task tool_use blocks in a single message to run concurrently

When NOT to use Task:
- Reading a specific file → use Read/Glob directly
- Simple lookups you can do in one tool call
- Tasks that need the current conversation context (the sub-agent is stateless)

Usage notes:
- Always include a short description (3-5 words) and a detailed, self-contained prompt
- The sub-agent does NOT see this conversation — include all necessary context in the prompt
- Clearly state whether the sub-agent should write code or just research
- Sub-agents can delegate further (Task is available to them) up to depth limit
- The result is not visible to the user — you must summarize it yourself

Example:

<example>
user: "Please write a function that checks if a number is prime"
assistant: (writes the function using the Edit tool)
assistant: (launches Task with description="verify prime function", prompt="Verify that isPrime() in src/math.ts is correct. Run available tests and report pass/fail with evidence.")
</example>

<example>
user: "investigate why the app hangs on startup"
assistant: (launches Task with description="investigate startup hang", prompt="Investigate why the main process hangs on startup. Trace the initialization path in src/main/, identify the blocking await, and report the root cause with file:line evidence.")
</example>`

export function createTaskTool(_providerGetter: () => ProviderConfig): ToolHandler {
  return {
    definition: {
      name: TASK_TOOL_NAME,
      description: TASK_DESCRIPTION,
      inputSchema: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'A short (3-5 word) description of the task, used for display'
          },
          prompt: {
            type: 'string',
            description:
              'The task for the sub-agent to perform. Be specific about the deliverable — the sub-agent does not see this conversation. Include all necessary context.'
          }
        },
        required: ['description', 'prompt'],
        additionalProperties: false
      }
    },
    execute: async () => nativeOnlyTaskResult(),
    requiresApproval: () => false
  }
}
