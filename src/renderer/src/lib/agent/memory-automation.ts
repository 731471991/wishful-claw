import { estimateTokens } from '@renderer/lib/format-tokens'
import { IPC } from '@renderer/lib/ipc/channels'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { runSidecarTextRequest } from '@renderer/lib/ipc/agent-bridge'
import { useChatStore } from '@renderer/stores/chat-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import type { ProviderConfig } from '@renderer/lib/api/types'
import {
  getProjectMemoryCandidatePaths,
  isMissingFileErrorMessage,
  joinFsPath,
  loadLayeredMemorySnapshot,
  readTextFile,
  resolveGlobalMemoryHomePath,
  resolveProjectMemoryTextFileForTarget,
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

import {
  AUTO_RUN_DEBOUNCE_MS,
  INVALID_MEMORY_JSON_ERROR,
  GLOBAL_USER_TEMPLATE,
  GLOBAL_MEMORY_TEMPLATE,
  PROJECT_USER_TEMPLATE,
  PROJECT_MEMORY_TEMPLATE,
  SUMMARY_TEMPLATE,
  yesterdayString,
  fingerprintContent,
  buildConversationExcerpt,
  summarizeMemorySnapshot,
  hasUsableProvider,
  resolveAutomationProvider,
  sanitizeMemoryPayload,
  parseConsolidationJson,
  getErrorMessage,
  targetForRoot,
  userTargetForRoot,
  extractStage1Outputs,
  buildMemoryRootInputs,
  findRootForScope,
  buildStage1Input,
  ensureMarkdownDocument,
  appendPipelineSection,
  buildRawMemoriesMarkdown,
  buildRolloutSummaryMarkdown,
  buildSummaryFallback,
  buildConsolidationPrompt,
  escapeRegExp,
  type ConsolidationOutput,
  type DailyRollupOptions,
  type RunSessionOptions,
  type TargetDescriptor,
} from './memory-automation-utils'



const runningSessionAutomations = new Set<string>()
let lastAutoRunBySession = new Map<string, number>()
let rollupInstalled = false




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
      conversation: buildConversationExcerpt(messages as any, options.assistantMessageId),
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


export async function runManualMemoryAutomationForActiveSession(): Promise<void> {
  const sessionId = useChatStore.getState().activeSessionId
  if (!sessionId) return
  await ipcClient.invoke(IPC.MEMORY_AUTOMATION_RUN_SESSION, { sessionId })
  await runMemoryAutomationForSession({ sessionId, manual: true })
}

