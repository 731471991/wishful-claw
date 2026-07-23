// Pure utility functions, constants, and types extracted from memory-automation.ts

import { Allow, parse as parsePartialJSON } from 'partial-json'
import { runSidecarTextRequest } from '@renderer/lib/ipc/agent-bridge'
import { useProviderStore } from '@renderer/stores/provider-store'
import type { ContentBlock, ProviderConfig, UnifiedMessage } from '@renderer/lib/api/types'
import {
  getProjectMemoryCandidatePaths,
  type LayeredMemorySnapshot
} from './memory-files'
import type {
  MemoryAutomationFilterReason,
  MemoryAutomationTarget,
  MemoryRootDescriptor,
  MemoryRootInput,
  MemoryRootScope,
  MemoryStage1Output,
  MemoryStage1OutputInput
} from '../../../../shared/memory-automation-types'

export const MAX_RECENT_MESSAGES = 16
export const MAX_MESSAGE_CHARS = 3200
export const AUTO_RUN_DEBOUNCE_MS = 5000
export const INVALID_MEMORY_JSON_ERROR = 'invalid_json'

export const GLOBAL_USER_TEMPLATE = `# USER.md

This file captures durable user preferences and collaboration style.

## Preferences
`

export const GLOBAL_MEMORY_TEMPLATE = `# MEMORY.md

This file stores global durable memory shared across OpenCowork sessions.

## Stable Preferences

## Workflow Habits

## Recurring Errors

## Durable Decisions
`

export const PROJECT_USER_TEMPLATE = `# USER.md

This file captures workspace-specific preferences for the human you are helping.

## Preferences
`

export const PROJECT_MEMORY_TEMPLATE = `# MEMORY.md

This file stores project-scoped durable memory.

## Decisions

## Workflow Habits

## Recurring Errors

## Context
`

export const SUMMARY_TEMPLATE = `# Memory Summary

## Summary
`

export interface RunSessionOptions {
  sessionId: string
  assistantMessageId?: string | null
  memorySnapshot?: LayeredMemorySnapshot
  source?: string
  aborted?: boolean
  manual?: boolean
}

export interface DailyRollupOptions {
  projectRootPath?: string | null
  sshConnectionId?: string | null
  global?: boolean
}

export interface PipelineScopeOutput {
  scope: MemoryRootScope
  rawMemory: string
  rolloutSummary: string
  rolloutSlug: string
}

export interface ConsolidationOutput {
  userMarkdown?: string
  memoryMarkdown?: string
  summaryMarkdown?: string
  writtenItems?: string[]
}

export interface Stage1BuildResult {
  input?: MemoryStage1OutputInput
  reason?: MemoryAutomationFilterReason
  content?: string
}

export interface TargetDescriptor {
  target: MemoryAutomationTarget
  path: string
  content: string
  missingFile: boolean
  sshConnectionId?: string | null
}

export function todayString(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function yesterdayString(date = new Date()): string {
  const previous = new Date(date)
  previous.setDate(previous.getDate() - 1)
  return todayString(previous)
}

export function normalizeMemoryText(value: string): string {
  return value
    .replace(/^- \[\d{4}-\d{2}-\d{2}\]\s*/gm, '')
    .replace(/[`*_~#[\]()>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function fingerprintContent(value: string): string {
  const normalized = normalizeMemoryText(value)
  let hash = 2166136261
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `mem-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function rolloutSlugFromSession(sessionId: string, scope: MemoryRootScope): string {
  const date = todayString()
  const safeSession = sessionId.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48)
  return `${date}-${scope}-${safeSession || 'session'}`
}

export function trimForPrompt(value: string, maxChars: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars)}...`
}

export function contentBlocksToText(blocks: ContentBlock[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'text') {
      parts.push(block.text)
    } else if (block.type === 'agent_error') {
      parts.push(`[agent_error] ${block.message}`)
    } else if (block.type === 'tool_use') {
      parts.push(`[tool_use] ${block.name}`)
    } else if (block.type === 'tool_result' && block.isError) {
      if (typeof block.content === 'string') {
        parts.push(`[tool_error] ${trimForPrompt(block.content, 1000)}`)
      } else {
        parts.push('[tool_error]')
      }
    }
  }
  return parts.join('\n')
}

export function messageToPromptLine(message: UnifiedMessage): string {
  const raw =
    typeof message.content === 'string' ? message.content : contentBlocksToText(message.content)
  return `${message.role}: ${trimForPrompt(raw, MAX_MESSAGE_CHARS)}`
}

export function buildConversationExcerpt(
  messages: UnifiedMessage[],
  assistantMessageId?: string | null
): string {
  const filtered = messages.filter((message) => message.role !== 'system')
  const tail = filtered.slice(-MAX_RECENT_MESSAGES)
  const finalAssistant = assistantMessageId
    ? messages.find((message) => message.id === assistantMessageId)
    : [...messages].reverse().find((message) => message.role === 'assistant')
  const lines = tail.map(messageToPromptLine)
  if (finalAssistant && !tail.some((message) => message.id === finalAssistant.id)) {
    lines.push(`final_assistant: ${messageToPromptLine(finalAssistant)}`)
  }
  return lines.join('\n\n')
}

export function summarizeMemorySnapshot(snapshot: LayeredMemorySnapshot): string {
  const parts = [
    snapshot.globalUser?.path ? `global_user=${snapshot.globalUser.path}` : '',
    snapshot.globalMemory?.path ? `global_memory=${snapshot.globalMemory.path}` : '',
    snapshot.globalMemorySummary?.path ? `global_summary=${snapshot.globalMemorySummary.path}` : '',
    snapshot.projectUser?.path ? `project_user=${snapshot.projectUser.path}` : '',
    snapshot.projectMemory?.path ? `project_memory=${snapshot.projectMemory.path}` : '',
    snapshot.projectMemorySummary?.path
      ? `project_summary=${snapshot.projectMemorySummary.path}`
      : '',
    snapshot.globalDailyMemory.length
      ? `global_daily=${snapshot.globalDailyMemory.map((entry) => entry.path).join(', ')}`
      : '',
    snapshot.projectDailyMemory.length
      ? `project_daily=${snapshot.projectDailyMemory.map((entry) => entry.path).join(', ')}`
      : ''
  ].filter(Boolean)
  return parts.join('\n')
}

export function hasUsableProvider(provider: ProviderConfig | null): provider is ProviderConfig {
  return Boolean(
    provider &&
      provider.type !== 'openai-images' &&
      (provider.apiKey || provider.requiresApiKey === false)
  )
}

export function resolveAutomationProvider(): ProviderConfig | null {
  const providerStore = useProviderStore.getState()
  return providerStore.getFastProviderConfig() ?? (providerStore.getActiveProvider() as any)
}

export function hasSecretLikeText(content: string): boolean {
  return (
    /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/i.test(content) ||
    /\bsk-[A-Za-z0-9_-]{20,}\b/.test(content) ||
    /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}\b/.test(content) ||
    /\bAKIA[0-9A-Z]{16}\b/.test(content) ||
    /\bAIza[0-9A-Za-z_-]{20,}\b/.test(content) ||
    /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/.test(content) ||
    /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|bearer|password|passwd|secret)\b\s*[:=]\s*\S+/i.test(
      content
    )
  )
}

export function redactSecretLikeText(content: string): string {
  return content
    .replace(/-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/gi, '[REDACTED_PRIVATE_KEY]')
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_OPENAI_KEY]')
    .replace(/\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}\b/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED_AWS_KEY]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[REDACTED_GOOGLE_KEY]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g, '[REDACTED_SLACK_TOKEN]')
    .replace(
      /\b(api[_-]?key|access[_-]?token|auth[_-]?token|bearer|password|passwd|secret)\b\s*[:=]\s*\S+/gi,
      '$1=[REDACTED]'
    )
}

export function hasPrivateIdentityText(content: string): boolean {
  return (
    /\b(?:ssn|social security|passport|driver'?s license|credit card|bank account)\b/i.test(
      content
    ) || /(?:身份证|护照|银行卡|手机号|手机号码|家庭住址)/.test(content)
  )
}

export function isTemporaryChatter(content: string): boolean {
  const normalized = normalizeMemoryText(content)
  if (normalized.length < 8) return true
  return /^(thanks?|thank you|ok|okay|好的|谢谢|收到|明白)$/.test(normalized)
}

export function sanitizeMemoryPayload(content: string): {
  content: string
  reason?: MemoryAutomationFilterReason
} {
  const trimmed = content.replace(/\r\n/g, '\n').trim()
  if (!trimmed || isTemporaryChatter(trimmed)) return { content: '', reason: 'temporary_chatter' }
  if (hasPrivateIdentityText(trimmed)) return { content: '', reason: 'private_identity' }
  const redacted = hasSecretLikeText(trimmed) ? redactSecretLikeText(trimmed) : trimmed
  if (!redacted.trim() || /\[REDACTED/.test(redacted) !== hasSecretLikeText(trimmed)) {
    return { content: redacted.trim(), reason: hasSecretLikeText(trimmed) ? 'secret' : undefined }
  }
  return { content: redacted.trim(), reason: hasSecretLikeText(trimmed) ? 'secret' : undefined }
}

export function normalizeJsonTextCandidate(raw: string): string {
  return raw
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json|JSON)?\s*/, '')
    .replace(/```$/, '')
    .trim()
}

export function uniqueJsonRepairCandidates(raw: string): string[] {
  const withoutTrailingCommas = raw.replace(/,\s*([}\]])/g, '$1')
  const candidates = [
    raw,
    withoutTrailingCommas,
    withoutTrailingCommas
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
  ]
  return [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))]
}

export function extractBalancedJsonSegments(raw: string): string[] {
  const segments: string[] = []
  let start = -1
  let stack: string[] = []
  let inString = false
  let quote = ''
  let escaped = false

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        inString = false
        quote = ''
      }
      continue
    }
    if (char === '"' || char === "'") {
      inString = true
      quote = char
      continue
    }
    if (char === '{' || char === '[') {
      if (stack.length === 0) start = index
      stack.push(char === '{' ? '}' : ']')
      continue
    }
    if ((char === '}' || char === ']') && stack.length > 0) {
      const expected = stack[stack.length - 1]
      if (char !== expected) {
        start = -1
        stack = []
        continue
      }
      stack.pop()
      if (stack.length === 0 && start >= 0) {
        segments.push(raw.slice(start, index + 1))
        start = -1
      }
    }
  }
  return segments
}

export function collectJsonTextCandidates(raw: string): string[] {
  const candidates = new Set<string>()
  const trimmed = raw.trim()
  if (trimmed) candidates.add(trimmed)
  for (const match of raw.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)) {
    const fenced = match[1]?.trim()
    if (fenced) candidates.add(fenced)
  }
  for (const segment of extractBalancedJsonSegments(raw)) {
    candidates.add(segment)
  }
  return [...candidates]
}

export function parseJsonTextCandidate(raw: string): unknown | null {
  const candidate = normalizeJsonTextCandidate(raw)
  if (!candidate) return null
  for (const text of uniqueJsonRepairCandidates(candidate)) {
    try {
      return JSON.parse(text) as unknown
    } catch {
      try {
        return parsePartialJSON(text, Allow.ALL) as unknown
      } catch {
        // Continue trying repaired candidates.
      }
    }
  }
  return null
}

export function parseJsonPayload(raw: string): unknown {
  for (const candidate of collectJsonTextCandidates(raw)) {
    const parsed = parseJsonTextCandidate(candidate)
    if (parsed !== null) return parsed
  }
  if (!raw.trim()) return { scope_outputs: [] }
  throw new Error(INVALID_MEMORY_JSON_ERROR)
}

export function parseStage1Json(raw: string, sessionId: string): PipelineScopeOutput[] {
  const parsed = parseJsonPayload(raw)
  if (!parsed || typeof parsed !== 'object') return []
  const scopeOutputs = (parsed as { scope_outputs?: unknown }).scope_outputs
  if (!Array.isArray(scopeOutputs)) return []
  const outputs: PipelineScopeOutput[] = []
  for (const item of scopeOutputs) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const scope = record.scope === 'project' ? 'project' : record.scope === 'global' ? 'global' : null
    if (!scope) continue
    const rawMemory = typeof record.raw_memory === 'string' ? record.raw_memory.trim() : ''
    const rolloutSummary =
      typeof record.rollout_summary === 'string' ? record.rollout_summary.trim() : ''
    const rolloutSlug =
      typeof record.rollout_slug === 'string' && record.rollout_slug.trim()
        ? record.rollout_slug.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)
        : rolloutSlugFromSession(sessionId, scope)
    if (!rawMemory && !rolloutSummary) continue
    outputs.push({
      scope,
      rawMemory,
      rolloutSummary: rolloutSummary || rawMemory.slice(0, 500),
      rolloutSlug
    })
  }
  return outputs
}

export function parseConsolidationJson(raw: string): ConsolidationOutput | null {
  const parsed = parseJsonPayload(raw)
  if (!parsed || typeof parsed !== 'object') return null
  const record = parsed as Record<string, unknown>
  const output: ConsolidationOutput = {}
  if (typeof record.user_markdown === 'string') output.userMarkdown = record.user_markdown
  if (typeof record.memory_markdown === 'string') output.memoryMarkdown = record.memory_markdown
  if (typeof record.summary_markdown === 'string') output.summaryMarkdown = record.summary_markdown
  if (Array.isArray(record.written_items)) {
    output.writtenItems = record.written_items.filter((item): item is string => typeof item === 'string')
  }
  return output
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function targetForRoot(root: MemoryRootDescriptor): MemoryAutomationTarget {
  return root.scope === 'project' ? 'project_memory' : 'global_memory'
}

export function userTargetForRoot(root: MemoryRootDescriptor): MemoryAutomationTarget {
  return root.scope === 'project' ? 'project_user' : 'global_user'
}

export function buildStage1Prompts(args: {
  conversation: string
  memorySnapshotText: string
  projectAvailable: boolean
  sessionId: string
}): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    'You are the OpenCowork implementation of Codex memory Phase 1.',
    'Extract raw memory signals from a completed MAIN session. Return strict JSON only.',
    'Schema: {"scope_outputs":[{"scope":"global|project","raw_memory":"markdown bullets","rollout_summary":"short markdown summary","rollout_slug":"short-slug"}]}.',
    'Use scope=global only for stable cross-project user preferences, collaboration habits, and recurring mistakes that apply broadly.',
    args.projectAvailable
      ? 'Use scope=project for repository decisions, project paths, commands, conventions, recurring project errors, and workspace-specific habits.'
      : 'No project root is available. Do not emit scope=project.',
    'Never include secrets, API keys, tokens, passwords, private keys, private identity numbers, bank/card/passport details, or transient small talk.',
    'Prefer zero outputs over weak or one-off details. Keep raw_memory concise and directly useful for future agents.',
    'Do not write final MEMORY.md. This phase only produces raw memory for later consolidation.'
  ].join('\n')

  const userPrompt = [
    '<session>',
    `id=${args.sessionId}`,
    args.conversation,
    '</session>',
    '',
    '<loaded_memory_snapshot>',
    args.memorySnapshotText || 'No existing memory snapshot.',
    '</loaded_memory_snapshot>'
  ].join('\n')

  return { systemPrompt, userPrompt }
}

export async function extractStage1Outputs(args: {
  provider: ProviderConfig
  conversation: string
  memorySnapshotText: string
  projectAvailable: boolean
  sessionId: string
}): Promise<PipelineScopeOutput[]> {
  const { systemPrompt, userPrompt } = buildStage1Prompts(args)
  const raw = await runSidecarTextRequest({
    provider: args.provider,
    messages: [
      { id: 'memory-stage1-system', role: 'system', content: systemPrompt, createdAt: Date.now() },
      { id: 'memory-stage1-user', role: 'user', content: userPrompt, createdAt: Date.now() }
    ],
    maxIterations: 1
  })
  return parseStage1Json(raw, args.sessionId)
}

export function buildMemoryRootInputs(args: {
  snapshot: LayeredMemorySnapshot
  projectId?: string | null
  sshConnectionId?: string | null
}): MemoryRootInput[] {
  const roots: MemoryRootInput[] = []
  if (args.snapshot.globalHomePath) {
    roots.push({
      scope: 'global',
      rootPath: args.snapshot.globalHomePath,
      transport: 'local'
    })
  }
  if (args.snapshot.projectRootPath) {
    roots.push({
      scope: 'project',
      projectId: args.projectId ?? null,
      workingFolder: args.snapshot.projectRootPath,
      sshConnectionId: args.sshConnectionId ?? null,
      rootPath: getProjectMemoryCandidatePaths(args.snapshot.projectRootPath).preferredPath,
      transport: args.sshConnectionId ? 'ssh' : 'local'
    })
  }
  return roots
}

export function findRootForScope(
  roots: MemoryRootDescriptor[] | undefined,
  scope: MemoryRootScope
): MemoryRootDescriptor | null {
  return roots?.find((root) => root.scope === scope) ?? null
}

export function buildStage1Input(args: {
  root: MemoryRootDescriptor
  scopeOutput: PipelineScopeOutput
  sourceSessionId: string
  sourceUpdatedAt?: number | null
}): Stage1BuildResult {
  const raw = sanitizeMemoryPayload(args.scopeOutput.rawMemory)
  if (!raw.content) {
    return {
      reason: raw.reason ?? 'temporary_chatter',
      content: args.scopeOutput.rawMemory
    }
  }
  const summary = sanitizeMemoryPayload(args.scopeOutput.rolloutSummary)
  const slug = args.scopeOutput.rolloutSlug || rolloutSlugFromSession(args.sourceSessionId, args.root.scope)
  return {
    input: {
      memoryRootId: args.root.id,
      scope: args.root.scope,
      sourceSessionId: args.sourceSessionId,
      sourceUpdatedAt: args.sourceUpdatedAt ?? null,
      rawMemory: raw.content,
      rolloutSummary: summary.content || raw.content.slice(0, 500),
      rolloutSlug: slug,
      fingerprint: fingerprintContent(`${args.root.id}:${args.sourceSessionId}:${raw.content}`),
      status: raw.reason || summary.reason ? 'filtered' : 'active'
    },
    reason: raw.reason ?? summary.reason,
    content: raw.content
  }
}

export function ensureMarkdownDocument(value: string, fallback: string): string {
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return `${trimmed}\n`
}

export function markdownContainsMemory(markdown: string, content: string): boolean {
  const normalizedContent = normalizeMemoryText(content)
  if (!normalizedContent) return false
  return markdown.split(/\r?\n/).some((line) => normalizeMemoryText(line) === normalizedContent)
}

export function appendPipelineSection(markdown: string, outputs: MemoryStage1Output[]): string {
  let next = ensureMarkdownDocument(markdown, GLOBAL_MEMORY_TEMPLATE)
  if (!/^## Pipeline Consolidated Memories$/im.test(next)) {
    next = `${next.trimEnd()}\n\n## Pipeline Consolidated Memories\n`
  }
  const lines = outputs
    .slice()
    .reverse()
    .flatMap((output) =>
      output.rawMemory
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
        .map((line) => `- [${todayString(new Date(output.createdAt))}] ${line}`)
    )
    .filter((line) => !markdownContainsMemory(next, line))
  if (lines.length === 0) return next
  return `${next.trimEnd()}\n${lines.join('\n')}\n`
}

export function buildRawMemoriesMarkdown(root: MemoryRootDescriptor, outputs: MemoryStage1Output[]): string {
  const sections = outputs
    .slice()
    .reverse()
    .map((output) =>
      [
        `## ${output.rolloutSlug}`,
        `- scope: ${root.scope}`,
        `- source_session_id: ${output.sourceSessionId}`,
        `- created_at: ${new Date(output.createdAt).toISOString()}`,
        '',
        output.rawMemory.trim()
      ].join('\n')
    )
  return `# Raw Memories\n\n${sections.join('\n\n')}\n`
}

export function buildRolloutSummaryMarkdown(root: MemoryRootDescriptor, output: MemoryStage1Output): string {
  return [
    `# ${output.rolloutSlug}`,
    '',
    `- scope: ${root.scope}`,
    `- memory_root_id: ${root.id}`,
    `- source_session_id: ${output.sourceSessionId}`,
    `- created_at: ${new Date(output.createdAt).toISOString()}`,
    '',
    output.rolloutSummary.trim(),
    ''
  ].join('\n')
}

export function buildSummaryFallback(memoryMarkdown: string): string {
  const lines = memoryMarkdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .slice(-80)
  return `# Memory Summary\n\n## Summary\n${lines.join('\n') || '- No durable memory yet.'}\n`
}

export function buildConsolidationPrompt(args: {
  root: MemoryRootDescriptor
  userMarkdown: string
  memoryMarkdown: string
  summaryMarkdown: string
  rawMemoriesMarkdown: string
}): string {
  return [
    'You are the OpenCowork implementation of Codex memory Phase 2 consolidation.',
    'Consolidate raw memories into durable Markdown files for exactly one memory root.',
    `Root scope: ${args.root.scope}. Root id: ${args.root.id}.`,
    args.root.scope === 'project'
      ? 'This is project memory. Keep repository decisions, paths, commands, conventions, and project-specific recurring errors here.'
      : 'This is global memory. Keep only cross-project preferences, habits, and broadly recurring errors here.',
    'Return strict JSON only with keys: user_markdown, memory_markdown, summary_markdown, written_items.',
    'Do not include secrets, tokens, private keys, passwords, private identity details, or transient chatter.',
    'Deduplicate existing facts. Keep concise bullets. Do not invent details not present in raw memories.',
    '',
    '<current_USER_md>',
    args.userMarkdown,
    '</current_USER_md>',
    '',
    '<current_MEMORY_md>',
    args.memoryMarkdown,
    '</current_MEMORY_md>',
    '',
    '<current_memory_summary_md>',
    args.summaryMarkdown,
    '</current_memory_summary_md>',
    '',
    '<raw_memories>',
    args.rawMemoriesMarkdown.slice(0, 120_000),
    '</raw_memories>'
  ].join('\n')
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function resolveProjectSummaryPath(projectRootPath: string): string {
  return getProjectMemoryCandidatePaths(projectRootPath, 'memory_summary.md').preferredPath
}

