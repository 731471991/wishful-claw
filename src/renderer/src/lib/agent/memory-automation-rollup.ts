import { estimateTokens } from '@renderer/lib/format-tokens'
import { IPC } from '@renderer/lib/ipc/channels'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { runSidecarTextRequest } from '@renderer/lib/ipc/agent-bridge'
import { useChatStore } from '@renderer/stores/chat-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import type { ProviderConfig } from '@renderer/lib/api/types'
import {
// Extracted from memory-automation.ts
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

