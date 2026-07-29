import { useUIStore } from '../../stores/ui-store'
import { useChatStore } from '../../stores/chat-store'
import { useTaskStore } from '../../stores/task-store'
import { usePlanStore } from '../../stores/plan-store'
import { useGoalStore } from '../../stores/goal-store'
import { useSettingsStore } from '../../stores/settings-store'
export { buildMemoryContext } from './memory-context-builder'
import { useAppPluginStore } from '../../stores/app-plugin-store'
import { CODEGRAPH_SYSTEM_GUIDANCE } from '../tools/codegraph-tool'
import { ipcClient } from '../ipc/ipc-client'
import { useMcpStore } from '../../stores/mcp-store'
import { getRegisteredSkills } from '../tools/skill-tool'
import { estimateTokens } from '../format-tokens'
import type { AIModelConfig } from '../api/types'
import { buildGoalSessionStateLine } from './goal-context'

const FILE_CONTEXT_BUDGET_RATIO = 0.25
const FILE_CONTEXT_BUDGET_MAX_TOKENS = 24_000
const FILE_CONTEXT_FALLBACK_TOKENS = 12_000

/**
 * Build a runtime reminder passed to the Native Worker as request context.
 * Includes lightweight session state and selected file contents.
 */
export async function buildRuntimeReminder(options: {
  sessionId: string
  modelConfig?: AIModelConfig | null
  /** The outgoing user prompt text — feeds the CodeGraph front-load hook. */
  userPrompt?: string
}): Promise<string> {
  const { sessionId, modelConfig, userPrompt } = options

  const parts: string[] = []
  const sessionStateContext = buildSessionStateContext(sessionId)
  if (sessionStateContext) {
    parts.push(sessionStateContext)
  }

  const selectedFiles = useUIStore.getState().selectedFiles ?? []
  const session = useChatStore.getState().sessions.find((s) => s.id === sessionId)
  const workingFolder = session?.workingFolder
  const sshConnectionId = session?.sshConnectionId

  // CodeGraph enabled + a local working folder -> steer the agent toward
  // codegraph_explore for code-navigation questions (the SERVER_INSTRUCTIONS playbook).
  if (
    workingFolder &&
    !sshConnectionId &&
    useAppPluginStore.getState().isCodeGraphToolAvailable()
  ) {
    parts.push(CODEGRAPH_SYSTEM_GUIDANCE)

    // Front-load hook (M7-W3 decision A, ≙ upstream `codegraph prompt-hook`): for a
    // structural/flow/impact prompt against an indexed project, inject graph-derived
    // context up front so the agent's reflex grep/read has nothing left to find.
    // Additive only — bounded timeout, any failure or non-fire injects nothing.
    if (userPrompt) {
      try {
        const { agentBridge } = await import('../ipc/agent-bridge')
        const hook = (await agentBridge.request(
          'codegraph/prompt-context',
          { prompt: userPrompt, workingFolder },
          15_000
        )) as { fired?: boolean; text?: string } | null
        if (hook?.fired && typeof hook.text === 'string' && hook.text.trim()) {
          parts.push(hook.text)
        }
      } catch {
        // the hook must never break the user's prompt
      }
    }
  }

  if (selectedFiles.length > 0) {
    const selectedFileContext = await buildSelectedFileContext(
      selectedFiles,
      workingFolder,
      sshConnectionId,
      modelConfig
    )
    if (selectedFileContext) {
      parts.push(selectedFileContext)
    }
  }

  if (parts.length === 0) {
    return ''
  }

  return `<system-reminder>\n${parts.join('\n')}\n</system-reminder>`
}

// The newest user message's plain text (string content, or joined text parts) —
// what the CodeGraph front-load hook gates on. Undefined when the last user turn
// has no extractable text (pure image turns etc.).
export function extractLatestUserPromptText(messages: unknown[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as { role?: string; content?: unknown } | null
    if (message?.role !== 'user') continue
    if (typeof message.content === 'string') {
      return message.content.trim() ? message.content : undefined
    }
    if (Array.isArray(message.content)) {
      const texts = message.content
        .map((part) =>
          part && typeof part === 'object' && (part as { type?: string }).type === 'text'
            ? (part as { text?: unknown }).text
            : undefined
        )
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      if (texts.length > 0) return texts.join('\n')
    }
    return undefined
  }
  return undefined
}

/**
 * Build a capability route text block listing available MCP servers/tools,
 * Skills, and proxied built-in tools. This text is injected into the system
 * prompt so the agent knows what it can call via use_capability — without
 * registering each tool individually (which would bloat the LLM request and
 * cause HTTP 413).
 *
 * Inspired by Reasonix's RenderTransientBlock.
 */
function buildCapabilityRoute(): string | null {
  const lines: string[] = []

  // MCP servers and their tools
  const mcpStore = useMcpStore.getState()
  const activeServers = mcpStore.getActiveMcps()
  const activeTools = mcpStore.getActiveMcpTools()
  const statuses = mcpStore.serverStatuses

  for (const server of activeServers) {
    const status = statuses[server.id] ?? 'configured'
    const tools = activeTools[server.id] ?? []
    const toolNames = tools.map((t) => t.name).join(', ') || '(no tools discovered)'
    lines.push(`- MCP ${server.name} (${status}): ${toolNames}`)
  }

  // Skills
  const skills = getRegisteredSkills()
  for (const skill of skills) {
    lines.push(`- Skill ${skill.name}: ${skill.description}`)
  }

  // Built-in proxied tools (low-frequency, not in preset)
  lines.push(
    '- Built-in extended tools (desktop automation, cron scheduling, notify,',
    '  image generation, notebook editing, widgets, team management,',
    '  channel plugins, plugin management, SSH info)'
  )

  return [
    '- Capabilities (use use_capability tool to call):',
    ...lines.map((l) => `  ${l}`),
    '  Use use_capability(action="list") to see all capabilities,',
    '  action="inspect" with capability_id to see a tool schema,',
    '  action="call" with capability_id and arguments to execute.'
  ].join('\n')
}

function buildSessionStateContext(sessionId: string): string | null {
  const parts: string[] = ['Session State:']

  // BrowserSearch is always available (multi-engine parallel search, no API key)
  parts.push(
    '- Web Search: available. Use the BrowserSearch tool to search the web when you need current information. It queries multiple search engines in parallel and returns aggregated results. No API key needed. Always prefer BrowserSearch for web searches.'
  )

  // Capability route: list MCP servers/tools and Skills so the agent
  // knows what it can call via use_capability — without bloating the
  // tool definitions in the LLM request.
  const capRoute = buildCapabilityRoute()
  if (capRoute) {
    parts.push(capRoute)
  }

  if (useSettingsStore.getState().webSearchEnabled) {
    parts.push(
      '- WebSearch (API): also enabled as an alternative search tool.'
    )
  }

  const goal = useGoalStore.getState().getGoalBySession(sessionId)
  if (goal) {
    parts.push(buildGoalSessionStateLine(goal))
    if (goal.status === 'active') {
      parts.push('  Reminder: Keep working toward the active goal unless the user redirects you.')
    }
    if (goal.status === 'paused') {
      parts.push('  Reminder: The goal is paused. Do not auto-continue it until resumed.')
    }
    if (goal.status === 'blocked') {
      parts.push('  Reminder: The goal is blocked. Do not claim it is unblocked without new input.')
    }
    if (goal.status === 'usage_limited') {
      parts.push('  Reminder: The goal is usage-limited. Wait for resume before continuing.')
    }
    if (goal.status === 'budget_limited') {
      parts.push('  Reminder: The goal is budget-limited. Wrap up instead of starting new work.')
    }
  }

  const tasks = useTaskStore.getState().getTasksBySession(sessionId)
  if (tasks.length > 0) {
    const pending = tasks.filter((task) => task.status === 'pending').length
    const inProgress = tasks.filter((task) => task.status === 'in_progress').length
    const completed = tasks.filter((task) => task.status === 'completed').length
    parts.push(
      `- Task List: ${tasks.length} tasks (${pending} pending, ${inProgress} in_progress, ${completed} completed)`
    )
    if (inProgress > 0 || pending > 0) {
      parts.push(
        '  Reminder: Continue with existing tasks and use TaskUpdate to keep status current.'
      )
    }
  }

  const plan = usePlanStore.getState().getPlanBySession(sessionId)
  if (plan) {
    parts.push(`- Plan: "${plan.title}" (status: ${plan.status})`)
    if (plan.status === 'awaiting_review') {
      parts.push(
        '  Reminder: The plan is awaiting user review. Do not implement until it is approved.'
      )
    }
    if (plan.status === 'approved' || plan.status === 'implementing') {
      parts.push('  Reminder: An approved plan exists. Follow the plan steps for implementation.')
    }
    if (plan.status === 'rejected') {
      parts.push('  Reminder: The plan was rejected. Revise it in Plan Mode based on feedback.')
    }
  }

  return parts.length > 1 ? parts.join('\n') : null
}

async function buildSelectedFileContext(
  selectedFiles: string[],
  workingFolder?: string,
  sshConnectionId?: string,
  modelConfig?: AIModelConfig | null
): Promise<string> {
  const budget = resolveFileContextBudget(modelConfig)
  let usedTokens = 0
  const fileSections: string[] = []
  const skipped: string[] = []

  for (const filePath of selectedFiles) {
    const displayPath =
      workingFolder && filePath.startsWith(workingFolder)
        ? filePath.slice(workingFolder.length).replace(/^[\\/]/, '')
        : filePath

    try {
      const content = await ipcClient.invoke(
        sshConnectionId ? 'ssh:fs:read-file' : 'fs:read-file',
        sshConnectionId ? { connectionId: sshConnectionId, path: filePath } : { path: filePath }
      )
      if (typeof content !== 'string') {
        skipped.push(`${displayPath} [unreadable]`)
        continue
      }

      const section = [`## ${displayPath}`, content].join('\n')
      const sectionTokens = estimateTokens(section)
      if (usedTokens + sectionTokens <= budget) {
        fileSections.push(section)
        usedTokens += sectionTokens
        continue
      }

      const remainingBudget = budget - usedTokens
      if (remainingBudget <= 0) {
        skipped.push(`${displayPath} [skipped: context budget exceeded]`)
        continue
      }

      const truncated = truncateToTokenBudget(content, remainingBudget)
      if (!truncated.trim()) {
        skipped.push(`${displayPath} [skipped: context budget exceeded]`)
        continue
      }

      fileSections.push(`## ${displayPath}\n${truncated}\n[Truncated due to context budget]`)
      usedTokens = budget
    } catch {
      skipped.push(`${displayPath} [read failed]`)
    }
  }

  if (fileSections.length === 0 && skipped.length === 0) {
    return ''
  }

  const lines = ['<selected_files>', `Selected Files: ${selectedFiles.length}`]
  if (fileSections.length > 0) {
    lines.push(...fileSections)
  }
  if (skipped.length > 0) {
    lines.push('## Skipped Files', ...skipped.map((item) => `- ${item}`))
  }
  lines.push('</selected_files>')
  return lines.join('\n')
}

function resolveFileContextBudget(modelConfig?: AIModelConfig | null): number {
  const contextLength = modelConfig?.contextLength
  if (typeof contextLength !== 'number' || contextLength <= 0) {
    return FILE_CONTEXT_FALLBACK_TOKENS
  }
  return Math.min(
    FILE_CONTEXT_BUDGET_MAX_TOKENS,
    Math.max(4_000, Math.floor(contextLength * FILE_CONTEXT_BUDGET_RATIO))
  )
}

function truncateToTokenBudget(content: string, tokenBudget: number): string {
  if (!content || tokenBudget <= 0) return ''
  const lines = content.split(/\r?\n/)
  const kept: string[] = []
  for (const line of lines) {
    const candidate = kept.length > 0 ? `${kept.join('\n')}\n${line}` : line
    if (estimateTokens(candidate) > tokenBudget) {
      break
    }
    kept.push(line)
  }
  return kept.join('\n')
}

