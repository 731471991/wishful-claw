import { estimateTokens } from '@renderer/lib/format-tokens'
import { IPC } from '@renderer/lib/ipc/channels'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { runSidecarTextRequest } from '@renderer/lib/ipc/agent-bridge'
import { useChatStore } from '@renderer/stores/chat-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import type { ProviderConfig } from '@renderer/lib/api/types'
import {
  recordEntry,
  recordSyntheticEntry,
  pipelineRun,
  prepareSessionPipeline,
  completeStage1,
  createPhase2Job,
  completePhase2Job,
  listStage1Outputs,
  readRootFile,
  writeTargetContent,
  runConsolidation,
  writeWithRetry,
  runPhase2ForRoot
} from './memory-automation-internal'
import { AUTO_RUN_DEBOUNCE_MS, INVALID_MEMORY_JSON_ERROR, RunSessionOptions, TargetDescriptor, buildConversationExcerpt, buildMemoryRootInputs, buildStage1Input, findRootForScope, fingerprintContent, hasUsableProvider, resolveAutomationProvider, summarizeMemorySnapshot, targetForRoot } from './memory-automation-utils'
import { loadLayeredMemorySnapshot } from './memory-files'
import { getErrorMessage } from './memory-json-parsers'

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


// Daily rollup and manual automation extracted to memory-automation-rollup.ts
export {
  runDailyMemoryRollup,
  undoMemoryAutomationEntry,
  runManualMemoryAutomationForActiveSession,
} from './memory-automation-rollup'

export {
  installMemoryAutomationDailyRollup,
} from './memory-automation-rollup'
