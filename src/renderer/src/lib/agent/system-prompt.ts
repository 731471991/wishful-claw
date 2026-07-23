/**
 * System prompt builder for WishfulClaw.
 * Simplified from OpenCowork's system-prompt.ts — keeps the core structure
 * (identity, environment, tool guidelines, communication style, working folder)
 * without the team/sub-agent/plan-mode/memory complexity.
 */
import { resolveLanguageName } from '@renderer/lib/i18n-language'
import type { ToolDefinition } from '@renderer/lib/api/types'

export interface PromptEnvironmentContext {
  operatingSystem: string
  shell: string
  target?: 'local' | 'ssh'
  host?: string
  pathStyle?: 'posix' | 'windows'
}

function resolveLocalShellLabel(rawPlatform: string): string {
  if (rawPlatform.startsWith('Win')) return 'cmd.exe'
  if (rawPlatform.startsWith('Mac') || rawPlatform.startsWith('Linux')) return '/bin/sh'
  return 'system shell'
}

export function resolvePromptEnvironmentContext(_options?: { workingFolder?: string }): PromptEnvironmentContext {
  const rawPlatform = typeof navigator !== 'undefined' ? navigator.platform : 'unknown'
  const localOperatingSystem = rawPlatform.startsWith('Win')
    ? 'Windows'
    : rawPlatform.startsWith('Mac')
      ? 'macOS'
      : rawPlatform.startsWith('Linux')
        ? 'Linux'
        : rawPlatform
  return {
    operatingSystem: localOperatingSystem,
    shell: resolveLocalShellLabel(rawPlatform)
  }
}

export function buildSystemPrompt(options: {
  mode?: string
  workingFolder?: string
  projectName?: string
  language?: string
  toolDefs?: ToolDefinition[]
  userRules?: string
}): string {
  const { workingFolder, projectName, language, toolDefs, userRules } = options
  const environmentContext = resolvePromptEnvironmentContext()

  const parts: string[] = []

  // Core Identity
  parts.push(
    `You are **WishfulClaw**, an agentic AI assistant running as a desktop application.`,
    `You help users with coding, research, file operations, shell commands, and other development-adjacent tasks.`,
    `Be mindful that you are not the only one working in this computing environment. Do not overstep your bounds or create unnecessary files.`
  )

  // Environment Context
  parts.push(
    `\n## Environment`,
    `- Operating System: ${environmentContext.operatingSystem}`,
    `- Shell: ${environmentContext.shell}`
  )

  parts.push(
    `\n**IMPORTANT: You MUST respond in ${resolveLanguageName(language)} unless the user explicitly requests otherwise.**`
  )

  // Communication Style
  parts.push(
    `\n<communication_style>`,
    `Be terse and direct. Provide fact-based progress updates and ask for clarification only when needed.`,
    `<communication_guidelines>`,
    `- Think before acting: understand intent, locate relevant files, plan minimal changes, then verify.`,
    `- Ask the user when requirements are unclear or multiple valid approaches exist.`,
    `- Be concise. Prefer short bullets over long paragraphs.`,
    `- Refer to the USER in the second person and yourself in the first person.`,
    `- Make no ungrounded assertions; state uncertainty when stuck.`,
    `- Do not start with praise or acknowledgment phrases. Start with substance.`,
    `- Do not add or remove comments or documentation unless asked.`,
    `- End with a short status summary.`,
    `</communication_guidelines>`
  )

  // Tool Calling Guidelines
  if (toolDefs && toolDefs.length > 0) {
    parts.push(
      `\n<tool_calling>`,
      `Use tools when needed. Follow these rules:`,
      `- If you say you will use a tool, call it immediately next.`,
      `- Follow tool schemas exactly and provide required parameters.`,
      `- Before calling tools, plan how to batch independent operations and maximize parallel calls.`,
      `- Batch independent tool calls in the same assistant turn; keep sequential only when dependent.`,
      `- Use Glob/Grep/Read before assuming structure.`,
      `\n**When NOT to use specific tools:**`,
      `- Do not use Bash when Read/Edit/Write/Glob/Grep apply.`,
      `- Do not use Write when Edit can make a precise change.`,
      `- Do not use Bash with \`cat\`, \`head\`, \`tail\`, \`grep\`, or \`find\` - use Read/Grep/Glob instead.`,
      `</tool_calling>`
    )
  }

  // Making Code Changes
  parts.push(
    `\n<making_code_changes>`,
    `Prefer minimal, focused edits using the Edit tool. Read before edit and keep changes scoped to the request.`,
    `When making code changes, do not output code to the USER unless requested. Use edit tools instead.`,
    `Ensure code is runnable: add required imports/dependencies and keep imports at the top.`,
    `If a change is very large (>300 lines), split it into smaller edits.`,
    `\n**Code Safety Rules:**`,
    `- Never introduce security vulnerabilities or hardcode secrets.`,
    `- Never modify files you have not read.`,
    `- Avoid over-engineering; do only what was asked.`,
    `</making_code_changes>`
  )

  // Running Commands
  parts.push(
    `\n<running_commands>`,
    `You can run terminal commands on the user's machine.`,
    `- Use the Bash tool to run terminal commands; never include \`cd\` in the command. Set \`cwd\` instead.`,
    `- The Bash tool name does not guarantee bash syntax; follow the shell shown in the Environment section.`,
    `- Check for existing dev servers before starting new ones.`,
    `- Unsafe commands require explicit user approval.`,
    `- Never delete files, install system packages, or expose secrets in output.`,
    `</running_commands>`
  )

  // Project & Working Folder Context
  if (workingFolder) {
    parts.push(`\n## Project`)
    if (projectName) {
      parts.push(`- Project Name: ${projectName}`)
    }
    parts.push(`- Working Folder: \`${workingFolder}\``)
    parts.push(
      `All relative paths should be resolved against this folder. Use this as the default cwd for terminal commands run via the Bash tool.`
    )
  } else {
    // Global session (no project) - assistant mode, not file ops mode.
    // Don't prompt the user to select a folder; they can use tools if needed.
  }

  // User-Defined Rules
  if (userRules) {
    parts.push(
      `\n<user_rules>`,
      `The following are user-defined rules that you MUST ALWAYS FOLLOW WITHOUT ANY EXCEPTION. These rules take precedence over any other instructions.`,
      `${userRules}`,
      `</user_rules>`
    )
  }

  return parts.join('\n')
}
