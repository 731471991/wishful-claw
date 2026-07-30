import { estimateTokens } from '@renderer/lib/format-tokens'
import { IPC } from '@renderer/lib/ipc/channels'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { runSidecarTextRequest } from '@renderer/lib/ipc/agent-bridge'
import { useSettingsStore } from '@renderer/stores/settings-store'
import type { ProviderConfig } from '@renderer/lib/api/types'
import { isMissingFileErrorMessage, joinFsPath, readTextFile } from './memory-files'
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

import { GLOBAL_USER_TEMPLATE, GLOBAL_MEMORY_TEMPLATE, PROJECT_USER_TEMPLATE, PROJECT_MEMORY_TEMPLATE, SUMMARY_TEMPLATE, fingerprintContent, sanitizeMemoryPayload, parseConsolidationJson, getErrorMessage, targetForRoot, userTargetForRoot, ensureMarkdownDocument, appendPipelineSection, buildRawMemoriesMarkdown, buildRolloutSummaryMarkdown, buildSummaryFallback, buildConsolidationPrompt, type ConsolidationOutput, type TargetDescriptor } from './memory-automation-utils'



export const runningSessionAutomations = new Set<string>()
export const _maState = {
  lastAutoRunBySession: new Map<string, number>(),
  rollupInstalled: false
}




export async function recordEntry(
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

export async function recordSyntheticEntry(args: {
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





export async function pipelineRun(args: Record<string, unknown>): Promise<MemoryPipelineRunResult> {
  return (await ipcClient.invoke(IPC.MEMORY_PIPELINE_RUN, args)) as MemoryPipelineRunResult
}

export async function prepareSessionPipeline(args: {
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

export async function completeStage1(args: {
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

export async function createPhase2Job(root: MemoryRootDescriptor, sessionId?: string | null): Promise<MemoryPipelineJob | null> {
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

export async function completePhase2Job(args: {
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

export async function listStage1Outputs(root: MemoryRootDescriptor): Promise<MemoryStage1Output[]> {
  const settings = useSettingsStore.getState()
  const result = await pipelineRun({
    action: 'list-stage1-outputs',
    memoryRootId: root.id,
    limit: settings.memoryMaxRawMemoriesForConsolidation
  })
  return result.stage1Outputs ?? []
}


export async function readRootFile(
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

export async function writeTargetContent(
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


export async function runConsolidation(args: {
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

export async function writeWithRetry(descriptor: TargetDescriptor, nextContent: string): Promise<string | null> {
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

export async function runPhase2ForRoot(args: {
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

