import { Allow, parse as parsePartialJSON } from 'partial-json'
import { estimateTokens } from '@renderer/lib/format-tokens'
import { IPC } from '@renderer/lib/ipc/channels'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { runSidecarTextRequest } from '@renderer/lib/ipc/agent-bridge'
import { useChatStore } from '@renderer/stores/chat-store'
import { useProviderStore } from '@renderer/stores/provider-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import type { ContentBlock, ProviderConfig, UnifiedMessage } from '@renderer/lib/api/types'
import {
  getProjectMemoryCandidatePaths,
  isMissingFileErrorMessage,
  joinFsPath,
  loadLayeredMemorySnapshot,
  readTextFile,
  resolveGlobalMemoryHomePath,
  resolveProjectMemoryTextFileForTarget,
  type LayeredMemorySnapshot
} from './memory-files'
import type {
  MemoryAutomationCandidateKind,
  MemoryAutomationEntry,
  MemoryAutomationFilterReason,
  MemoryAutomationListResult,
  MemoryAutomationRecordInput,
  MemoryAutomationRecordResult,
  MemoryAutomationRunRollupResult,
  MemoryAutomationStatus,
  MemoryAutomationTarget,
  MemoryAutomationUndoResult,
  MemoryJobStatus,
  MemoryPipelineJob,
  MemoryPipelineRunResult,
  MemoryRootDescriptor,
  MemoryRootInput,
  MemoryRootScope,
  MemoryStage1Output,
  MemoryStage1OutputInput
} from '../../../../shared/memory-automation-types'

const MAX_RECENT_MESSAGES = 16
const MAX_MESSAGE_CHARS = 3200
const AUTO_RUN_DEBOUNCE_MS = 5000
const INVALID_MEMORY_JSON_ERROR = 'invalid_json'

const GLOBAL_USER_TEMPLATE = `# USER.md

This file captures durable user preferences and collaboration style.

## Preferences
`

const GLOBAL_MEMORY_TEMPLATE = `# MEMORY.md

This file stores global durable memory shared across OpenCowork sessions.

## Stable Preferences

## Workflow Habits

## Recurring Errors

## Durable Decisions
`

const PROJECT_USER_TEMPLATE = `# USER.md

This file captures workspace-specific preferences for the human you are helping.

## Preferences
`

const PROJECT_MEMORY_TEMPLATE = `# MEMORY.md

This file stores project-scoped durable memory.

## Decisions

## Workflow Habits

## Recurring Errors

## Context
`

const SUMMARY_TEMPLATE = `# Memory Summary

## Summary
`

interface RunSessionOptions {
  sessionId: string
  assistantMessageId?: string | null
  memorySnapshot?: LayeredMemorySnapshot
  source?: string
  aborted?: boolean
  manual?: boolean
}

interface DailyRollupOptions {
  projectRootPath?: string | null
  sshConnectionId?: string | null
  global?: boolean
}

interface PipelineScopeOutput {
  scope: MemoryRootScope
  rawMemory: string
  rolloutSummary: string
  rolloutSlug: string
}

interface ConsolidationOutput {
  userMarkdown?: string
  memoryMarkdown?: string
  summaryMarkdown?: string
  writtenItems?: string[]
}

interface Stage1BuildResult {
  input?: MemoryStage1OutputInput
  reason?: MemoryAutomationFilterReason
  content?: string
}

interface TargetDescriptor {
  target: MemoryAutomationTarget
  path: string
  content: string
  missingFile: boolean
  sshConnectionId?: string | null
}

const runningSessionAutomations = new Set<string>()
let lastAutoRunBySession = new Map<string, number>()
let rollupInstalled = false

function todayString(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function yesterdayString(date = new Date()): string {
  const previous = new Date(date)
  previous.setDate(previous.getDate() - 1)
  return todayString(previous)
}

function normalizeMemoryText(value: string): string {
  return value
    .replace(/^- \[\d{4}-\d{2}-\d{2}\]\s*/gm, '')
    .replace(/[`*_~#[\]()>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function fingerprintContent(value: string): string {
  const normalized = normalizeMemoryText(value)
  let hash = 2166136261
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `mem-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function rolloutSlugFromSession(sessionId: string, scope: MemoryRootScope): string {
  const date = todayString()
  const safeSession = sessionId.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48)
  return `${date}-${scope}-${safeSession || 'session'}`
}

function trimForPrompt(value: string, maxChars: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars)}...`
}

function contentBlocksToText(blocks: ContentBlock[]): string {
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

function messageToPromptLine(message: UnifiedMessage): string {
  const raw =
    typeof message.content === 'string' ? message.content : contentBlocksToText(message.content)
  return `${message.role}: ${trimForPrompt(raw, MAX_MESSAGE_CHARS)}`
}

function buildConversationExcerpt(
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

function summarizeMemorySnapshot(snapshot: LayeredMemorySnapshot): string {
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

function hasUsableProvider(provider: ProviderConfig | null): provider is ProviderConfig {
  return Boolean(
    provider &&
      provider.type !== 'openai-images' &&
      (provider.apiKey || provider.requiresApiKey === false)
  )
}

function resolveAutomationProvider(): ProviderConfig | null {
  const providerStore = useProviderStore.getState()
  return providerStore.getFastProviderConfig() ?? providerStore.getActiveProviderConfig()
}

function hasSecretLikeText(content: string): boolean {
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

function redactSecretLikeText(content: string): string {
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

function hasPrivateIdentityText(content: string): boolean {
  return (
    /\b(?:ssn|social security|passport|driver'?s license|credit card|bank account)\b/i.test(
      content
    ) || /(?:身份证|护照|银行卡|手机号|手机号码|家庭住址)/.test(content)
  )
}

function isTemporaryChatter(content: string): boolean {
  const normalized = normalizeMemoryText(content)
  if (normalized.length < 8) return true
  return /^(thanks?|thank you|ok|okay|好的|谢谢|收到|明白)$/.test(normalized)
}

function sanitizeMemoryPayload(content: string): {
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

function normalizeJsonTextCandidate(raw: string): string {
  return raw
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json|JSON)?\s*/, '')
    .replace(/```$/, '')
    .trim()
}

function uniqueJsonRepairCandidates(raw: string): string[] {
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

function extractBalancedJsonSegments(raw: string): string[] {
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

function collectJsonTextCandidates(raw: string): string[] {
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

function parseJsonTextCandidate(raw: string): unknown | null {
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

function parseJsonPayload(raw: string): unknown {
  for (const candidate of collectJsonTextCandidates(raw)) {
    const parsed = parseJsonTextCandidate(candidate)
    if (parsed !== null) return parsed
  }
  if (!raw.trim()) return { scope_outputs: [] }
  throw new Error(INVALID_MEMORY_JSON_ERROR)
}

function parseStage1Json(raw: string, sessionId: string): PipelineScopeOutput[] {
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

function parseConsolidationJson(raw: string): ConsolidationOutput | null {
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function recordEntry(
  input: MemoryAutomationRecordInput
): Promise<MemoryAutomationEntry | null> {
  const result = (await ipcClient.invoke(
    IPC.MEMORY_AUTOMATION_RECORD,
    input
  )) as MemoryAutomationRecordResult
  if (!result.success) {
    console.warn('[MemoryAutomation] Failed to record entry:', result.error)
    return null
  }
  return result.entry ?? null
}

async function recordSyntheticEntry(args: {
  status: MemoryAutomationStatus
  reason?: MemoryAutomationFilterReason
  sourceSessionId?: string | null
  target?: MemoryAutomationTarget
  rootScope?: MemoryRootScope | null
  memoryRootId?: string | null
  jobId?: string | null
  projectId?: string | null
  kind?: MemoryAutomationCandidateKind
  content: string
  targetPath?: string | null
  error?: string | null
}): Promise<void> {
  await recordEntry({
    scope: 'main',
    rootScope: args.rootScope ?? null,
    memoryRootId: args.memoryRootId ?? null,
    jobId: args.jobId ?? null,
    projectId: args.projectId ?? null,
    target: args.target ?? (args.rootScope === 'project' ? 'project_memory' : 'global_memory'),
    kind: args.kind ?? 'daily_context',
    content: args.content,
    confidence: 0,
    sourceSessionId: args.sourceSessionId,
    targetPath: args.targetPath ?? null,
    status: args.status,
    filterReason: args.reason,
    fingerprint: fingerprintContent(`${args.reason ?? args.status}:${args.content}`),
    error: args.error ?? null
  })
}

function targetForRoot(root: MemoryRootDescriptor): MemoryAutomationTarget {
  return root.scope === 'project' ? 'project_memory' : 'global_memory'
}

function userTargetForRoot(root: MemoryRootDescriptor): MemoryAutomationTarget {
  return root.scope === 'project' ? 'project_user' : 'global_user'
}

function buildStage1Prompts(args: {
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

async function extractStage1Outputs(args: {
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

function buildMemoryRootInputs(args: {
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

function findRootForScope(
  roots: MemoryRootDescriptor[] | undefined,
  scope: MemoryRootScope
): MemoryRootDescriptor | null {
  return roots?.find((root) => root.scope === scope) ?? null
}

async function pipelineRun(args: Record<string, unknown>): Promise<MemoryPipelineRunResult> {
  return (await ipcClient.invoke(IPC.MEMORY_PIPELINE_RUN, args)) as MemoryPipelineRunResult
}

async function prepareSessionPipeline(args: {
  sessionId: string
  roots: MemoryRootInput[]
}): Promise<MemoryPipelineRunResult> {
  return pipelineRun({
    action: 'prepare-session',
    sessionId: args.sessionId,
    roots: args.roots,
    leaseOwner: 'renderer'
  })
}

async function completeStage1(args: {
  sessionId: string
  jobId?: string | null
  status?: MemoryJobStatus
  error?: string | null
  outputs: MemoryStage1OutputInput[]
}): Promise<MemoryPipelineRunResult> {
  return pipelineRun({
    action: 'complete-stage1',
    sessionId: args.sessionId,
    jobId: args.jobId,
    status: args.status,
    error: args.error,
    stage1Outputs: args.outputs
  })
}

async function createPhase2Job(root: MemoryRootDescriptor, sessionId?: string | null): Promise<MemoryPipelineJob | null> {
  const result = await pipelineRun({
    action: 'record-job',
    jobKind: 'phase2',
    status: 'running',
    memoryRootId: root.id,
    sessionId,
    leaseOwner: 'renderer'
  })
  return result.job ?? null
}

async function completePhase2Job(args: {
  root: MemoryRootDescriptor
  jobId?: string | null
  sessionId?: string | null
  status: MemoryJobStatus
  error?: string | null
}): Promise<void> {
  await pipelineRun({
    action: 'complete-phase2',
    memoryRootId: args.root.id,
    jobId: args.jobId,
    sessionId: args.sessionId,
    status: args.status,
    error: args.error
  })
}

async function listStage1Outputs(root: MemoryRootDescriptor): Promise<MemoryStage1Output[]> {
  const settings = useSettingsStore.getState()
  const result = await pipelineRun({
    action: 'list-stage1-outputs',
    memoryRootId: root.id,
    limit: settings.memoryMaxRawMemoriesForConsolidation
  })
  return result.stage1Outputs ?? []
}

function buildStage1Input(args: {
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

async function readRootFile(
  root: MemoryRootDescriptor,
  relativePath: string,
  fallback: string
): Promise<TargetDescriptor> {
  const filePath = joinFsPath(root.rootPath, ...relativePath.split('/'))
  const read = await readTextFile(ipcClient, filePath, root.sshConnectionId)
  return {
    target:
      relativePath === 'USER.md'
        ? userTargetForRoot(root)
        : relativePath === 'memory_summary.md'
          ? 'summary_cache'
          : targetForRoot(root),
    path: filePath,
    content: read.error ? fallback : (read.content ?? ''),
    missingFile: Boolean(read.error && isMissingFileErrorMessage(read.error)),
    sshConnectionId: root.sshConnectionId
  }
}

async function writeTargetContent(
  descriptor: TargetDescriptor,
  nextContent: string,
  beforeContent?: string
): Promise<string | null> {
  const connectionId = descriptor.sshConnectionId?.trim()
  const result = connectionId
    ? await ipcClient.invoke(IPC.SSH_FS_WRITE_FILE, {
        connectionId,
        path: descriptor.path,
        content: nextContent,
        ...(beforeContent !== undefined ? { beforeContent } : {})
      })
    : await ipcClient.invoke(IPC.FS_WRITE_FILE, {
        path: descriptor.path,
        content: nextContent,
        ...(beforeContent !== undefined ? { beforeContent } : {})
      })

  if (result && typeof result === 'object' && 'error' in result) {
    return String((result as { error?: unknown }).error ?? 'Failed to write file')
  }
  return null
}

function ensureMarkdownDocument(value: string, fallback: string): string {
  const trimmed = value.trim()
  if (!trimmed) return fallback
  return `${trimmed}\n`
}

function markdownContainsMemory(markdown: string, content: string): boolean {
  const normalizedContent = normalizeMemoryText(content)
  if (!normalizedContent) return false
  return markdown.split(/\r?\n/).some((line) => normalizeMemoryText(line) === normalizedContent)
}

function appendPipelineSection(markdown: string, outputs: MemoryStage1Output[]): string {
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

function buildRawMemoriesMarkdown(root: MemoryRootDescriptor, outputs: MemoryStage1Output[]): string {
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

function buildRolloutSummaryMarkdown(root: MemoryRootDescriptor, output: MemoryStage1Output): string {
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

function buildSummaryFallback(memoryMarkdown: string): string {
  const lines = memoryMarkdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .slice(-80)
  return `# Memory Summary\n\n## Summary\n${lines.join('\n') || '- No durable memory yet.'}\n`
}

function buildConsolidationPrompt(args: {
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

async function runConsolidation(args: {
  provider: ProviderConfig
  root: MemoryRootDescriptor
  userMarkdown: string
  memoryMarkdown: string
  summaryMarkdown: string
  rawMemoriesMarkdown: string
}): Promise<ConsolidationOutput | null> {
  const raw = await runSidecarTextRequest({
    provider: args.provider,
    messages: [
      {
        id: `memory-phase2-${args.root.id}`,
        role: 'user',
        content: buildConsolidationPrompt(args),
        createdAt: Date.now()
      }
    ],
    maxIterations: 1
  })
  return parseConsolidationJson(raw)
}

async function writeWithRetry(descriptor: TargetDescriptor, nextContent: string): Promise<string | null> {
  const before = descriptor.missingFile ? undefined : descriptor.content
  let error = await writeTargetContent(descriptor, nextContent, before)
  if (error?.includes('File changed since it was read')) {
    const refreshed = await readTextFile(ipcClient, descriptor.path, descriptor.sshConnectionId)
    if (!refreshed.error) {
      error = await writeTargetContent(descriptor, nextContent, refreshed.content ?? '')
    }
  }
  return error
}

async function runPhase2ForRoot(args: {
  root: MemoryRootDescriptor
  provider: ProviderConfig
  sourceSessionId?: string | null
}): Promise<void> {
  const phase2Job = await createPhase2Job(args.root, args.sourceSessionId)
  try {
    const outputs = await listStage1Outputs(args.root)
    if (outputs.length === 0) {
      await completePhase2Job({
        root: args.root,
        jobId: phase2Job?.id,
        sessionId: args.sourceSessionId,
        status: 'succeeded_no_output'
      })
      return
    }

    const userDescriptor = await readRootFile(
      args.root,
      'USER.md',
      args.root.scope === 'project' ? PROJECT_USER_TEMPLATE : GLOBAL_USER_TEMPLATE
    )
    const memoryDescriptor = await readRootFile(
      args.root,
      'MEMORY.md',
      args.root.scope === 'project' ? PROJECT_MEMORY_TEMPLATE : GLOBAL_MEMORY_TEMPLATE
    )
    const summaryDescriptor = await readRootFile(args.root, 'memory_summary.md', SUMMARY_TEMPLATE)
    const rawDescriptor = await readRootFile(args.root, 'raw_memories.md', '# Raw Memories\n')

    const rawMemoriesMarkdown = buildRawMemoriesMarkdown(args.root, outputs)
    const rawWriteError = await writeWithRetry(rawDescriptor, rawMemoriesMarkdown)
    if (rawWriteError) throw new Error(rawWriteError)

    for (const output of outputs) {
      const rolloutDescriptor = await readRootFile(
        args.root,
        `rollout_summaries/${output.rolloutSlug}.md`,
        ''
      )
      const rolloutError = await writeWithRetry(
        rolloutDescriptor,
        buildRolloutSummaryMarkdown(args.root, output)
      )
      if (rolloutError) throw new Error(rolloutError)
    }

    let consolidation: ConsolidationOutput | null = null
    try {
      consolidation = await runConsolidation({
        provider: args.provider,
        root: args.root,
        userMarkdown: userDescriptor.content,
        memoryMarkdown: memoryDescriptor.content,
        summaryMarkdown: summaryDescriptor.content,
        rawMemoriesMarkdown
      })
    } catch (error) {
      console.warn('[MemoryAutomation] Phase 2 model consolidation failed, using fallback:', error)
    }

    const nextUser = ensureMarkdownDocument(
      sanitizeMemoryPayload(consolidation?.userMarkdown ?? userDescriptor.content).content ||
        userDescriptor.content,
      userDescriptor.content
    )
    const fallbackMemory = appendPipelineSection(memoryDescriptor.content, outputs)
    const nextMemory = ensureMarkdownDocument(
      sanitizeMemoryPayload(consolidation?.memoryMarkdown ?? fallbackMemory).content ||
        fallbackMemory,
      fallbackMemory
    )
    const needsSummary =
      estimateTokens(nextMemory) > Math.max(1000, useSettingsStore.getState().memorySummaryBudgetTokens)
    const nextSummary = ensureMarkdownDocument(
      sanitizeMemoryPayload(
        consolidation?.summaryMarkdown ?? (needsSummary ? buildSummaryFallback(nextMemory) : nextMemory)
      ).content || buildSummaryFallback(nextMemory),
      SUMMARY_TEMPLATE
    )

    const writeTargets = [
      { descriptor: userDescriptor, content: nextUser },
      { descriptor: memoryDescriptor, content: nextMemory },
      { descriptor: summaryDescriptor, content: nextSummary }
    ]
    for (const item of writeTargets) {
      if (item.descriptor.content === item.content) continue
      const error = await writeWithRetry(item.descriptor, item.content)
      if (error) throw new Error(error)
    }

    await recordEntry({
      scope: 'main',
      rootScope: args.root.scope,
      memoryRootId: args.root.id,
      jobId: phase2Job?.id ?? null,
      projectId: args.root.projectId ?? null,
      target: targetForRoot(args.root),
      kind: args.root.scope === 'project' ? 'project_decision' : 'workflow_habit',
      content: `Consolidated ${outputs.length} raw memory item(s) for ${args.root.scope} memory`,
      confidence: 1,
      sourceSessionId: args.sourceSessionId,
      targetPath: memoryDescriptor.path,
      status: 'written',
      fingerprint: fingerprintContent(`${args.root.id}:${outputs.map((output) => output.id).join(':')}`),
      evidence: {
        memoryRootId: args.root.id,
        stage1OutputIds: outputs.map((output) => output.id),
        writtenItems: consolidation?.writtenItems ?? []
      },
      writtenAt: Date.now(),
      beforeContent: memoryDescriptor.content,
      afterContent: nextMemory,
      appendedText: null,
      sshConnectionId: args.root.sshConnectionId ?? null
    })

    await completePhase2Job({
      root: args.root,
      jobId: phase2Job?.id,
      sessionId: args.sourceSessionId,
      status: 'succeeded'
    })
  } catch (error) {
    const message = getErrorMessage(error)
    await completePhase2Job({
      root: args.root,
      jobId: phase2Job?.id,
      sessionId: args.sourceSessionId,
      status: 'failed',
      error: message
    })
    await recordSyntheticEntry({
      status: 'error',
      reason: 'write_error',
      sourceSessionId: args.sourceSessionId,
      rootScope: args.root.scope,
      memoryRootId: args.root.id,
      jobId: phase2Job?.id ?? null,
      projectId: args.root.projectId ?? null,
      target: targetForRoot(args.root),
      content: 'Memory phase 2 consolidation failed',
      targetPath: args.root.rootPath,
      error: message
    })
  }
}

export async function runMemoryAutomationForSession(options: RunSessionOptions): Promise<void> {
  const settings = useSettingsStore.getState()
  if (!settings.memoryAutomationEnabled || !settings.memoryGenerateMemories) {
    if (options.manual) {
      await recordSyntheticEntry({
        status: 'skipped',
        reason: 'disabled',
        sourceSessionId: options.sessionId,
        content: 'Memory generation is disabled'
      })
    }
    return
  }
  if (options.aborted) return

  const now = Date.now()
  const lastRunAt = lastAutoRunBySession.get(options.sessionId) ?? 0
  if (!options.manual && now - lastRunAt < AUTO_RUN_DEBOUNCE_MS) return
  lastAutoRunBySession = new Map(lastAutoRunBySession).set(options.sessionId, now)

  if (runningSessionAutomations.has(options.sessionId)) return
  runningSessionAutomations.add(options.sessionId)
  let stage1JobId: string | null = null

  try {
    const chatState = useChatStore.getState()
    const session = chatState.sessions.find((item) => item.id === options.sessionId)
    if (!session) return
    if (settings.memoryAutomationMainSessionsOnly && session.pluginId) {
      await recordSyntheticEntry({
        status: 'skipped',
        reason: 'unsupported_scope',
        sourceSessionId: options.sessionId,
        content: 'Skipped plugin/channel session'
      })
      return
    }

    const provider = resolveAutomationProvider()
    const providerType = provider?.type
    if (!hasUsableProvider(provider)) {
      await recordSyntheticEntry({
        status: 'skipped',
        reason: providerType === 'openai-images' ? 'unsupported_provider' : 'missing_provider',
        sourceSessionId: options.sessionId,
        content: 'No usable text provider for memory generation'
      })
      return
    }

    const messages = chatState.getSessionMessages(options.sessionId)
    if (messages.length === 0) {
      await recordSyntheticEntry({
        status: 'skipped',
        reason: 'no_candidates',
        sourceSessionId: options.sessionId,
        content: 'No session messages available for memory generation'
      })
      return
    }

    const snapshot =
      options.memorySnapshot ??
      (await loadLayeredMemorySnapshot(ipcClient, {
        workingFolder: session.workingFolder,
        sshConnectionId: session.sshConnectionId,
        scope: 'main'
      }))
    const rootInputs = buildMemoryRootInputs({
      snapshot,
      projectId: session.projectId,
      sshConnectionId: session.sshConnectionId
    })
    if (rootInputs.length === 0) {
      await recordSyntheticEntry({
        status: 'skipped',
        reason: 'missing_target',
        sourceSessionId: options.sessionId,
        content: 'No memory root available'
      })
      return
    }

    const prepared = await prepareSessionPipeline({
      sessionId: options.sessionId,
      roots: rootInputs
    })
    if (!prepared.success) throw new Error(prepared.error ?? 'Failed to prepare memory pipeline')
    stage1JobId = prepared.job?.id ?? null

    const scopeOutputs = await extractStage1Outputs({
      provider,
      conversation: buildConversationExcerpt(messages, options.assistantMessageId),
      memorySnapshotText: summarizeMemorySnapshot(snapshot),
      projectAvailable: Boolean(snapshot.projectRootPath),
      sessionId: options.sessionId
    })

    const stage1Inputs: MemoryStage1OutputInput[] = []
    for (const scopeOutput of scopeOutputs) {
      if (scopeOutput.scope === 'project' && !snapshot.projectRootPath) continue
      const root = findRootForScope(prepared.roots, scopeOutput.scope)
      if (!root) continue
      const built = buildStage1Input({
        root,
        scopeOutput,
        sourceSessionId: options.sessionId,
        sourceUpdatedAt: session.updatedAt
      })
      if (built.input) {
        stage1Inputs.push(built.input)
      }
      if (!built.input || built.input.status === 'filtered') {
        await recordSyntheticEntry({
          status: 'filtered',
          reason: built.reason ?? 'temporary_chatter',
          sourceSessionId: options.sessionId,
          rootScope: root.scope,
          memoryRootId: root.id,
          jobId: stage1JobId,
          projectId: root.projectId ?? null,
          target: targetForRoot(root),
          content: built.content || 'Stage 1 output was empty after safety filtering'
        })
      }
    }

    const activeStage1Inputs = stage1Inputs.filter((input) => input.status !== 'filtered')
    const completed = await completeStage1({
      sessionId: options.sessionId,
      jobId: stage1JobId,
      status: activeStage1Inputs.length > 0 ? 'succeeded' : 'succeeded_no_output',
      outputs: stage1Inputs
    })
    if (!completed.success) throw new Error(completed.error ?? 'Failed to complete stage 1')

    if (stage1Inputs.length === 0) {
      await recordSyntheticEntry({
        status: 'skipped',
        reason: 'no_candidates',
        sourceSessionId: options.sessionId,
        jobId: stage1JobId,
        content: 'Model returned no durable memory outputs'
      })
      return
    }
    if (activeStage1Inputs.length === 0) return

    const touchedRootIds = new Set(activeStage1Inputs.map((input) => input.memoryRootId))
    for (const root of prepared.roots ?? []) {
      if (!touchedRootIds.has(root.id)) continue
      await runPhase2ForRoot({
        root,
        provider,
        sourceSessionId: options.sessionId
      })
    }
  } catch (error) {
    const message = getErrorMessage(error)
    if (stage1JobId) {
      await completeStage1({
        sessionId: options.sessionId,
        jobId: stage1JobId,
        status: 'failed',
        error: message === INVALID_MEMORY_JSON_ERROR ? INVALID_MEMORY_JSON_ERROR : message,
        outputs: []
      }).catch(() => {})
    }
    await recordSyntheticEntry({
      status: 'error',
      reason: message === INVALID_MEMORY_JSON_ERROR ? 'invalid_json' : 'write_error',
      sourceSessionId: options.sessionId,
      jobId: stage1JobId,
      target: 'global_memory',
      content: 'Memory pipeline failed',
      error: message
    })
  } finally {
    runningSessionAutomations.delete(options.sessionId)
  }
}

async function runRollupForDescriptor(args: {
  root: MemoryRootDescriptor
  descriptor: TargetDescriptor
  sourceDate: string
  provider: ProviderConfig
}): Promise<void> {
  if (!args.descriptor.content.trim()) return
  const contentHash = fingerprintContent(args.descriptor.content)
  const watermark = (await ipcClient.invoke(IPC.MEMORY_AUTOMATION_RUN_ROLLUP, {
    action: 'get-watermark',
    scope: 'main',
    targetPath: args.descriptor.path,
    sourceDate: args.sourceDate,
    contentHash
  })) as MemoryAutomationRunRollupResult
  if (watermark.alreadyProcessed) {
    await recordSyntheticEntry({
      status: 'skipped',
      reason: 'rollup_already_processed',
      sourceSessionId: `rollup:${args.sourceDate}`,
      rootScope: args.root.scope,
      memoryRootId: args.root.id,
      projectId: args.root.projectId ?? null,
      target: targetForRoot(args.root),
      content: `Daily rollup already processed for ${args.descriptor.path}`,
      targetPath: args.descriptor.path
    })
    return
  }

  const built = buildStage1Input({
    root: args.root,
    scopeOutput: {
      scope: args.root.scope,
      rawMemory: args.descriptor.content,
      rolloutSummary: `Daily memory rollup from ${args.sourceDate}`,
      rolloutSlug: `${args.sourceDate}-${args.root.scope}-daily-rollup`
    },
    sourceSessionId: `rollup:${args.sourceDate}`
  })
  if (!built.input || built.input.status === 'filtered') {
    if (built.reason) {
      await recordSyntheticEntry({
        status: 'filtered',
        reason: built.reason,
        sourceSessionId: `rollup:${args.sourceDate}`,
        rootScope: args.root.scope,
        memoryRootId: args.root.id,
        projectId: args.root.projectId ?? null,
        target: targetForRoot(args.root),
        content: built.content || 'Daily rollup was filtered'
      })
    }
    return
  }

  await completeStage1({
    sessionId: `rollup:${args.sourceDate}`,
    status: 'succeeded',
    outputs: [built.input]
  })
  await runPhase2ForRoot({
    root: args.root,
    provider: args.provider,
    sourceSessionId: `rollup:${args.sourceDate}`
  })
  await ipcClient.invoke(IPC.MEMORY_AUTOMATION_RUN_ROLLUP, {
    action: 'mark-watermark',
    scope: 'main',
    targetPath: args.descriptor.path,
    sourceDate: args.sourceDate,
    contentHash
  })
}

export async function runDailyMemoryRollup(options: DailyRollupOptions = {}): Promise<void> {
  const settings = useSettingsStore.getState()
  if (
    !settings.memoryAutomationEnabled ||
    !settings.memoryGenerateMemories ||
    !settings.memoryDailyRollupEnabled
  ) {
    return
  }

  const provider = resolveAutomationProvider()
  if (!hasUsableProvider(provider)) return

  const sourceDate = yesterdayString()
  const rootInputs: MemoryRootInput[] = []
  const globalHomePath = await resolveGlobalMemoryHomePath(ipcClient)
  const includeGlobal = options.global ?? true
  if (includeGlobal && globalHomePath) {
    rootInputs.push({ scope: 'global', rootPath: globalHomePath, transport: 'local' })
  }
  if (options.projectRootPath) {
    rootInputs.push({
      scope: 'project',
      workingFolder: options.projectRootPath,
      sshConnectionId: options.sshConnectionId ?? null,
      rootPath: getProjectMemoryCandidatePaths(options.projectRootPath).preferredPath,
      transport: options.sshConnectionId ? 'ssh' : 'local'
    })
  }
  if (rootInputs.length === 0) return

  const prepared = await prepareSessionPipeline({ sessionId: `rollup:${sourceDate}`, roots: rootInputs })
  if (!prepared.success) return
  const targets: Array<{ root: MemoryRootDescriptor; descriptor: TargetDescriptor }> = []

  const globalRoot = findRootForScope(prepared.roots, 'global')
  if (includeGlobal && globalRoot && globalHomePath) {
    const path = joinFsPath(globalHomePath, 'memory', `${sourceDate}.md`)
    const read = await readTextFile(ipcClient, path)
    if (!read.error && read.content?.trim()) {
      targets.push({
        root: globalRoot,
        descriptor: {
          target: 'global_daily',
          path,
          content: read.content,
          missingFile: false,
          sshConnectionId: null
        }
      })
    }
  }

  const projectRoot = findRootForScope(prepared.roots, 'project')
  if (projectRoot && options.projectRootPath) {
    const resolved = await resolveProjectMemoryTextFileForTarget(
      ipcClient,
      options.projectRootPath,
      options.sshConnectionId,
      'memory',
      `${sourceDate}.md`
    )
    if (!resolved.error && !resolved.missingFile && resolved.content?.trim()) {
      targets.push({
        root: projectRoot,
        descriptor: {
          target: 'project_daily',
          path: resolved.path,
          content: resolved.content,
          missingFile: false,
          sshConnectionId: options.sshConnectionId ?? null
        }
      })
    }
  }

  for (const target of targets) {
    await runRollupForDescriptor({
      root: target.root,
      descriptor: target.descriptor,
      sourceDate,
      provider
    })
  }
}

export function installMemoryAutomationDailyRollup(): void {
  if (rollupInstalled) return
  rollupInstalled = true
  window.setTimeout(() => {
    const activeProjectId = useChatStore.getState().activeProjectId
    const project = useChatStore.getState().projects.find((item) => item.id === activeProjectId)
    void runDailyMemoryRollup({
      projectRootPath: project?.workingFolder,
      sshConnectionId: project?.sshConnectionId,
      global: true
    }).catch((error) => {
      console.warn('[MemoryAutomation] Daily rollup failed:', error)
    })
  }, 8000)
}

export async function undoMemoryAutomationEntry(entry: MemoryAutomationEntry): Promise<{
  success: boolean
  error?: string
}> {
  if (entry.status !== 'written' || !entry.targetPath) {
    return { success: false, error: 'Only written entries can be undone' }
  }

  const result = (await ipcClient.invoke(IPC.MEMORY_AUTOMATION_LIST, {
    id: entry.id,
    includeContentSnapshots: true,
    limit: 1
  })) as MemoryAutomationListResult
  const fullEntry = result.entries[0] ?? entry
  const current = await readTextFile(ipcClient, fullEntry.targetPath!, fullEntry.sshConnectionId)
  if (current.error) {
    const undoResult = (await ipcClient.invoke(IPC.MEMORY_AUTOMATION_UNDO, {
      id: fullEntry.id,
      status: 'error',
      error: current.error
    })) as MemoryAutomationUndoResult
    return { success: false, error: undoResult.error ?? current.error }
  }

  let nextContent: string | null = null
  const appended = fullEntry.appendedText?.trim()
  if (appended && current.content?.includes(appended)) {
    nextContent = current.content
      .replace(new RegExp(`\\n?${escapeRegExp(appended)}\\n?`, 'm'), '\n')
      .replace(/\n{3,}/g, '\n\n')
  } else if (fullEntry.afterContent && current.content === fullEntry.afterContent) {
    nextContent = fullEntry.beforeContent ?? ''
  }

  if (nextContent === null) {
    const undoResult = (await ipcClient.invoke(IPC.MEMORY_AUTOMATION_UNDO, {
      id: fullEntry.id,
      status: 'error',
      error: 'Undo conflict: memory text was not found'
    })) as MemoryAutomationUndoResult
    return { success: false, error: undoResult.error ?? 'Undo conflict' }
  }

  const descriptor: TargetDescriptor = {
    target: fullEntry.target,
    path: fullEntry.targetPath!,
    content: current.content ?? '',
    missingFile: false,
    sshConnectionId: fullEntry.sshConnectionId ?? null
  }
  const writeError = await writeTargetContent(descriptor, nextContent, current.content ?? '')
  if (writeError) {
    await ipcClient.invoke(IPC.MEMORY_AUTOMATION_UNDO, {
      id: fullEntry.id,
      status: 'error',
      error: writeError
    })
    return { success: false, error: writeError }
  }

  const undoResult = (await ipcClient.invoke(IPC.MEMORY_AUTOMATION_UNDO, {
    id: fullEntry.id,
    status: 'undone'
  })) as MemoryAutomationUndoResult
  return undoResult.success ? { success: true } : { success: false, error: undoResult.error }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function runManualMemoryAutomationForActiveSession(): Promise<void> {
  const sessionId = useChatStore.getState().activeSessionId
  if (!sessionId) return
  await ipcClient.invoke(IPC.MEMORY_AUTOMATION_RUN_SESSION, { sessionId })
  await runMemoryAutomationForSession({ sessionId, manual: true })
}

export function resolveProjectSummaryPath(projectRootPath: string): string {
  return getProjectMemoryCandidatePaths(projectRootPath, 'memory_summary.md').preferredPath
}
