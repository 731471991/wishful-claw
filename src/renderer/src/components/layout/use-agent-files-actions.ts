import * as React from 'react'
import { toast } from 'sonner'
import { confirm } from '@renderer/components/ui/confirm-dialog'
import { generateCommitMessageFromStagedDiff } from '@renderer/lib/git/generate-commit-message'
import { useUIStore } from '@renderer/stores/ui-store'
import type { AgentFilesState } from './use-agent-files'
import type { ChangeRow, GitChangeRow, AgentChangeRow } from './agent-files-types'
import type { AgentFileTreeCommand } from '@renderer/components/cowork/file-tree-types'
import { gitDiffKey, dirname, repoRelativePath } from './agent-files-utils'
import { normalizeLanguageCode } from '../../lib/i18n-language'
import { useGitStore } from '../../stores/git-store'
import { actionableSourceChanges } from '../chat/file-change-utils'

export function useAgentFilesActions(state: AgentFilesState) {
  const {
    t, i18n, sessionView, workingFolder, sshConnectionId,
    selectedRepoPath, git, visibleRows, stageAll, stageFiles,
    getStagedDiffBundle, commitMessage, setCommitOpen, setCommitMessage,
    busyAction, setBusyAction, aiCommitLoading, setAiCommitLoading,
    branchDialog, setBranchDialog, branchValue, setBranchValue,
    setSelectedChangeKey, setFileTreeCommand, undoFileChange, undoRunChanges,
    refreshSessionRunChanges, runChangesByRunId, sessionChangeSets,
    latestChangeSet, agentChanges, agentSummaries, loadFileDiff,
    scanRepositories, selectedRepo, repoDetails, status, diffByKey,
    gitRowsBase, gitRows, agentRows, allRows, totals, undoableRunIds,
    visibleStagePaths,
    fileSearchOpen, setFileSearchOpen, preloadingDiffKeysRef,
    requestedRefreshRef, setActiveTab,
    activeTab, changeSource, setChangeSource, selectedChangeKey,
    diffOpen, setDiffOpen
  } = state

  const runGitAction = async (
    key: string,
    action: () => Promise<{ success: boolean; error?: string }>
  ): Promise<boolean> => {
    if (busyAction) return false
    setBusyAction(key)
    try {
      const result = await action()
      if (!result.success) {
        toast.error(result.error ?? t('agentFiles.actionFailed', { defaultValue: 'Action failed' }))
        return false
      }
      toast.success(t('agentFiles.actionComplete', { defaultValue: 'Action complete' }))
      return true
    } finally {
      setBusyAction(null)
    }
  }

  const loadGitDiff = React.useCallback(
    async (row: GitChangeRow): Promise<string> => {
      if (!selectedRepoPath) return ''
      await loadFileDiff(selectedRepoPath, row.filePath, row.section === 'staged')
      return (
        useGitStore.getState().repoDetailsByPath[selectedRepoPath]?.diffByKey[gitDiffKey(row)] ?? ''
      )
    },
    [loadFileDiff, selectedRepoPath]
  )

  const discardGitRows = async (rows: GitChangeRow[]): Promise<void> => {
    if (!git.selectedRepoPath || rows.length === 0) return
    const confirmed = await confirm({
      title: t('agentFiles.discardConfirmTitle', { defaultValue: 'Discard changes?' }),
      description: t('agentFiles.discardConfirmDesc', {
        count: rows.length,
        defaultValue: 'Discard {{count}} file change(s)? This cannot be undone.'
      }),
      confirmLabel: t('agentFiles.discard', { defaultValue: 'Discard' }),
      variant: 'destructive'
    })
    if (!confirmed) return

    const grouped: Record<'worktree' | 'full' | 'untracked', string[]> = {
      worktree: [],
      full: [],
      untracked: []
    }
    for (const row of rows) {
      if (row.section === 'untracked') grouped.untracked.push(row.filePath)
      else if (row.section === 'staged') grouped.full.push(row.filePath)
      else grouped.worktree.push(row.filePath)
    }

    await runGitAction('discard', async () => {
      for (const [scope, paths] of Object.entries(grouped) as Array<
        ['worktree' | 'full' | 'untracked', string[]]
      >) {
        if (paths.length === 0) continue
        const result = await git.discardFiles(git.selectedRepoPath!, paths, scope)
        if (!result.success) return result
      }
      return { success: true }
    })
  }

  const undoAgentRow = async (row: AgentChangeRow): Promise<void> => {
    const actionable = actionableSourceChanges(row.change)
    if (actionable.length === 0) return
    for (const entry of [...actionable].sort((a, b) => b.createdAt - a.createdAt)) {
      await undoFileChange(entry.runId, entry.id)
    }
  }

  const stageVisibleChangesForCommit = React.useCallback(async (): Promise<{
    success: boolean
    error?: string
  }> => {
    if (!selectedRepoPath) {
      return {
        success: false,
        error: t('agentFiles.noRepoSelected', { defaultValue: 'No repository selected' })
      }
    }
    if (visibleRows.length === 0) {
      return {
        success: false,
        error: t('agentFiles.noChangesToCommit', { defaultValue: 'No changes to commit' })
      }
    }
    return visibleStagePaths.length > 0
      ? stageFiles(selectedRepoPath, visibleStagePaths)
      : stageAll(selectedRepoPath)
  }, [selectedRepoPath, stageAll, stageFiles, t, visibleRows.length, visibleStagePaths])

  const handleCommit = async (): Promise<void> => {
    if (!selectedRepoPath || !commitMessage.trim()) return
    const committed = await runGitAction('commit', async () => {
      const stageResult = await stageVisibleChangesForCommit()
      if (!stageResult.success) return stageResult
      return git.commit(selectedRepoPath, commitMessage.trim())
    })
    if (!committed) return
    setCommitOpen(false)
    setCommitMessage('')
  }

  const handleGenerateCommitMessage = async (): Promise<void> => {
    if (!selectedRepoPath || busyAction !== null || aiCommitLoading) return
    setAiCommitLoading(true)
    try {
      const stageResult = await stageVisibleChangesForCommit()
      if (!stageResult.success) {
        toast.error(
          stageResult.error ?? t('agentFiles.actionFailed', { defaultValue: 'Action failed' })
        )
        return
      }

      const bundle = await getStagedDiffBundle(selectedRepoPath)
      if (!bundle.success) {
        toast.error(bundle.error)
        return
      }
      if (bundle.empty) {
        toast.error(
          t('agentFiles.aiCommitEmptyStaged', {
            defaultValue: 'Nothing staged — cannot generate a message'
          })
        )
        return
      }

      const message = await generateCommitMessageFromStagedDiff(
        bundle.stat,
        bundle.patch,
        normalizeLanguageCode(i18n.language),
        status?.branch,
        undefined,
        selectedRepoPath
      )
      if (!message) {
        toast.error(
          t('agentFiles.aiCommitFailed', {
            defaultValue: 'Generation failed. Check API / model settings and try again'
          })
        )
        return
      }
      setCommitMessage(message)
      toast.success(t('agentFiles.aiCommitGenerated', { defaultValue: 'Commit message generated' }))
    } finally {
      setAiCommitLoading(false)
    }
  }

  const handleBranchAction = async (): Promise<void> => {
    if (!git.selectedRepoPath || !branchDialog || !branchValue) return
    const mode = branchDialog
    await runGitAction(mode, () =>
      mode === 'checkout'
        ? git.checkoutBranch(git.selectedRepoPath!, branchValue)
        : git.mergeBranch(git.selectedRepoPath!, branchValue)
    )
    setBranchDialog(null)
    setBranchValue('')
  }

  const openSelectedDiff = (row: ChangeRow): void => {
    setSelectedChangeKey(row.key)
    setDiffOpen(true)
  }

  const sendFileTreeCommand = (type: AgentFileTreeCommand['type']): void => {
    setFileTreeCommand({ id: Date.now(), type })
  }

  const branchOptions = React.useMemo(
    () =>
      (repoDetails?.branches ?? []).filter(
        (branch) => branchDialog !== 'merge' || !branch.isCurrent
      ),
    [branchDialog, repoDetails?.branches]
  )
  const canUseCommitComposer = Boolean(
    selectedRepoPath && visibleRows.length > 0 && busyAction === null && !aiCommitLoading
  )
  const canCommitInline = canUseCommitComposer && commitMessage.trim().length > 0

  return {
    runGitAction, loadGitDiff, discardGitRows, undoAgentRow,
    stageVisibleChangesForCommit, handleCommit, handleGenerateCommitMessage,
    handleBranchAction, openSelectedDiff, sendFileTreeCommand,
    branchOptions, canUseCommitComposer, canCommitInline
  }
}

export type AgentFilesActions = ReturnType<typeof useAgentFilesActions>
