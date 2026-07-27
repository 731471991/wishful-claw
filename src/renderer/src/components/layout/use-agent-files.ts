import * as React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '@renderer/stores/ui-store'
import { useChatStore } from '@renderer/stores/chat-store'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useGitStore, type GitBranchItem, type GitStatusFile } from '@renderer/stores/git-store'
import { useAggregatedChangeSummaries } from '@renderer/components/chat/change-summary-utils'
import {
  actionableSourceChanges, aggregateDisplayableRunFileChanges,
  latestDisplayableRunChangeSet, type AggregatedFileChange
} from '@renderer/components/chat/file-change-utils'
import { normalizeLanguageCode } from '@renderer/lib/i18n-language'
import type { AgentFileTreeCommand } from '@renderer/components/cowork/file-tree-types'
import { EMPTY_DIFF_BY_KEY, MAX_PRELOAD_DIFFS } from './agent-files-types'
import type { GitSection, GitChangeRow, AgentChangeRow, ChangeRow } from './agent-files-types'
import {
  dirname, gitDiffKey,
  repoRelativePath, statusLetters, summarizeUnifiedDiff
} from './agent-files-utils'
import { DIFF_PRELOAD_BATCH_SIZE } from './agent-files-types'

export interface UseAgentFilesOptions {
  sessionId?: string | null
}

export function useAgentFiles(options: UseAgentFilesOptions = {}) {
  const { sessionId = null } = options
  const { t, i18n } = useTranslation('layout')
  const activeTab = useUIStore((state) => state.agentFilesActiveTabBySurface[surface] ?? initialTab)
  const panelVisible = true
  const setActiveTab = useUIStore((state) => state.setAgentFilesActiveTab)
  const selectedChangeKey = useUIStore((state) => state.agentFilesSelectedChangeKey)
  const setSelectedChangeKey = useUIStore((state) => state.setAgentFilesSelectedChangeKey)
  const changeSource = useUIStore((state) => state.agentFilesChangeSource)
  const setChangeSource = useUIStore((state) => state.setAgentFilesChangeSource)
  const sessionView = useChatStore(
    useShallow((state) => {
      const resolvedSessionId = sessionId ?? state.activeSessionId
      const currentSession = resolvedSessionId
        ? state.sessions.find((item) => item.id === resolvedSessionId)
        : undefined
      const currentProject = currentSession?.projectId
        ? state.projects.find((item) => item.id === currentSession.projectId)
        : undefined

      // Selecting the messages array itself would re-render the whole panel on
      // every streaming delta flush; a joined-id signature only changes when
      // an assistant message is added or removed.
      let assistantMessageIdsSignature = ''
      if (currentSession?.messages) {
        for (const message of currentSession.messages) {
          if (message.role === 'assistant') {
            assistantMessageIdsSignature += message.id + '\n'
          }
        }
      }

      return {
        sessionId: resolvedSessionId,
        projectId: currentSession?.projectId ?? currentProject?.id ?? null,
        workingFolder: currentSession?.workingFolder ?? currentProject?.workingFolder ?? null,
        sshConnectionId: currentSession?.sshConnectionId ?? currentProject?.sshConnectionId ?? null,
        assistantMessageIdsSignature
      }
    })
  )
  const { runChangesByRunId, refreshSessionRunChanges, undoFileChange, undoRunChanges } =
    useAgentStore(
      useShallow((state) => ({
        runChangesByRunId: state.runChangesByRunId,
        refreshSessionRunChanges: state.refreshSessionRunChanges,
        undoFileChange: state.undoFileChange,
        undoRunChanges: state.undoRunChanges
      }))
    )
  const git = useGitStore(
    useShallow((state) => ({
      repositories: state.repositories,
      selectedRepoPath: state.selectedRepoPath,
      repoDetailsByPath: state.repoDetailsByPath,
      isScanning: state.isScanning,
      scanError: state.scanError,
      scanRepositories: state.scanRepositories,
      selectRepository: state.selectRepository,
      refreshRepository: state.refreshRepository,
      loadFileDiff: state.loadFileDiff,
      fetchRepository: state.fetchRepository,
      pullRebase: state.pullRebase,
      checkoutBranch: state.checkoutBranch,
      mergeBranch: state.mergeBranch,
      stageAll: state.stageAll,
      stageFiles: state.stageFiles,
      unstageAll: state.unstageAll,
      discardFiles: state.discardFiles,
      commit: state.commit,
      getStagedDiffBundle: state.getStagedDiffBundle
    }))
  )
  const [diffOpen, setDiffOpen] = React.useState(false)
  const [commitOpen, setCommitOpen] = React.useState(false)
  const [commitMessage, setCommitMessage] = React.useState('')
  const [aiCommitLoading, setAiCommitLoading] = React.useState(false)
  const [branchDialog, setBranchDialog] = React.useState<'checkout' | 'merge' | null>(null)
  const [branchValue, setBranchValue] = React.useState('')
  const [busyAction, setBusyAction] = React.useState<string | null>(null)
  const [fileSearchOpen, setFileSearchOpen] = React.useState(false)
  const [fileTreeCommand, setFileTreeCommand] = React.useState<AgentFileTreeCommand | null>(null)
  const requestedRefreshRef = React.useRef<string | null>(null)
  const preloadingDiffKeysRef = React.useRef(new Set<string>())
  const selectedRepoPath = git.selectedRepoPath
  const scanRepositories = git.scanRepositories
  const loadFileDiff = git.loadFileDiff
  const stageAll = git.stageAll
  const stageFiles = git.stageFiles
  const getStagedDiffBundle = git.getStagedDiffBundle

  React.useEffect(() => {
    if (!panelVisible || activeTab !== 'changes') return
    if (!sessionView.sessionId) return
    if (requestedRefreshRef.current === sessionView.sessionId) return
    requestedRefreshRef.current = sessionView.sessionId
    void refreshSessionRunChanges(sessionView.sessionId)
  }, [activeTab, panelVisible, refreshSessionRunChanges, sessionView.sessionId])

  React.useEffect(() => {
    if (!panelVisible || activeTab !== 'changes') return
    if (!sessionView.workingFolder) return
    void scanRepositories()
  }, [activeTab, panelVisible, scanRepositories, sessionView.projectId, sessionView.workingFolder])

  const assistantMessageIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const id of sessionView.assistantMessageIdsSignature.split('\n')) {
      if (id) ids.add(id)
    }
    return ids
  }, [sessionView.assistantMessageIdsSignature])

  const sessionChangeSets = React.useMemo(() => {
    const seen = new Set<string>()
    return Object.values(runChangesByRunId)
      .filter((changeSet) => {
        if (!sessionView.sessionId) return false
        if (changeSet.sessionId === sessionView.sessionId) return true
        if (changeSet.changes.some((change) => change.sessionId === sessionView.sessionId))
          return true
        return (
          assistantMessageIds.has(changeSet.assistantMessageId) ||
          assistantMessageIds.has(changeSet.runId)
        )
      })
      .filter((changeSet) => {
        if (seen.has(changeSet.runId)) return false
        seen.add(changeSet.runId)
        return true
      })
      .sort((left, right) => left.createdAt - right.createdAt)
  }, [assistantMessageIds, runChangesByRunId, sessionView.sessionId])

  const latestChangeSet = React.useMemo(
    () => latestDisplayableRunChangeSet(sessionChangeSets),
    [sessionChangeSets]
  )
  const agentChanges = React.useMemo(
    () =>
      aggregateDisplayableRunFileChanges(latestChangeSet?.changes ?? []).sort(
        (left, right) => left.createdAt - right.createdAt
      ),
    [latestChangeSet]
  )
  const agentSummaries = useAggregatedChangeSummaries(agentChanges)

  const selectedRepo = React.useMemo(
    () => git.repositories.find((repo) => repo.fullPath === selectedRepoPath) ?? null,
    [git.repositories, selectedRepoPath]
  )
  const repoDetails = selectedRepoPath ? git.repoDetailsByPath[selectedRepoPath] : null
  const status = repoDetails?.status ?? null
  const diffByKey = repoDetails?.diffByKey ?? EMPTY_DIFF_BY_KEY

  const gitRowsBase = React.useMemo(() => {
    const rows: Array<Omit<GitChangeRow, 'added' | 'deleted'>> = []
    for (const file of status?.conflicted ?? []) {
      rows.push({
        source: 'git',
        key: `git:conflicted:${file.path}`,
        section: 'conflicted',
        file,
        filePath: file.path
      })
    }
    for (const file of status?.staged ?? []) {
      rows.push({
        source: 'git',
        key: `git:staged:${file.path}`,
        section: 'staged',
        file,
        filePath: file.path
      })
    }
    for (const file of status?.unstaged ?? []) {
      rows.push({
        source: 'git',
        key: `git:unstaged:${file.path}`,
        section: 'unstaged',
        file,
        filePath: file.path
      })
    }
    for (const file of status?.untracked ?? []) {
      rows.push({
        source: 'git',
        key: `git:untracked:${file.path}`,
        section: 'untracked',
        file,
        filePath: file.path
      })
    }
    return rows
  }, [status])

  React.useEffect(() => {
    if (!panelVisible || activeTab !== 'changes') return
    if (!selectedRepoPath || gitRowsBase.length === 0) return
    const cachedDiffs =
      useGitStore.getState().repoDetailsByPath[selectedRepoPath]?.diffByKey ?? EMPTY_DIFF_BY_KEY
    const preloadingDiffKeys = preloadingDiffKeysRef.current
    const missing = gitRowsBase.filter((row) => {
      if (row.section === 'untracked') return false
      const key = gitDiffKey(row)
      return cachedDiffs[key] === undefined && !preloadingDiffKeys.has(`${selectedRepoPath}:${key}`)
    })
    if (missing.length === 0) return
    const rowsToLoad = missing.slice(0, MAX_PRELOAD_DIFFS)
    for (const row of rowsToLoad) {
      preloadingDiffKeys.add(`${selectedRepoPath}:${gitDiffKey(row)}`)
    }
    const preload = async (): Promise<void> => {
      for (let index = 0; index < rowsToLoad.length; index += DIFF_PRELOAD_BATCH_SIZE) {
        await Promise.all(
          rowsToLoad.slice(index, index + DIFF_PRELOAD_BATCH_SIZE).map(async (row) => {
            const key = `${selectedRepoPath}:${gitDiffKey(row)}`
            try {
              await loadFileDiff(selectedRepoPath, row.filePath, row.section === 'staged')
            } finally {
              preloadingDiffKeysRef.current.delete(key)
            }
          })
        )
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
      }
    }
    void preload()
  }, [activeTab, gitRowsBase, loadFileDiff, panelVisible, selectedRepoPath])

  const gitRows: GitChangeRow[] = React.useMemo(
    () =>
      gitRowsBase.map((row) => {
        const stats =
          row.section === 'untracked'
            ? { added: 0, deleted: 0 }
            : summarizeUnifiedDiff(diffByKey[gitDiffKey(row)] ?? '')
        return { ...row, ...stats }
      }),
    [diffByKey, gitRowsBase]
  )

  const agentRows: AgentChangeRow[] = React.useMemo(
    () =>
      agentChanges.map((change) => {
        const summary = agentSummaries[change.id] ?? { added: 0, deleted: 0 }
        return {
          source: 'agent',
          key: `agent:${change.id}`,
          change,
          filePath: change.filePath,
          added: summary.added,
          deleted: summary.deleted
        }
      }),
    [agentChanges, agentSummaries]
  )

  const allRows = React.useMemo<ChangeRow[]>(() => [...agentRows, ...gitRows], [agentRows, gitRows])
  const visibleRows = React.useMemo(() => {
    if (changeSource === 'agent') return agentRows
    if (changeSource === 'git') return gitRows
    return allRows
  }, [agentRows, allRows, changeSource, gitRows])
  const selectedRow =
    visibleRows.find((row) => row.key === selectedChangeKey) ?? visibleRows[0] ?? null
  const visibleGitRows = React.useMemo(
    () => visibleRows.filter((row): row is GitChangeRow => row.source === 'git'),
    [visibleRows]
  )
  const visibleStagePaths = React.useMemo(
    () =>
      Array.from(
        new Set(
          visibleRows
            .map((row) =>
              row.source === 'git' ? row.filePath : repoRelativePath(selectedRepoPath, row.filePath)
            )
            .filter((path): path is string => Boolean(path))
        )
      ),
    [selectedRepoPath, visibleRows]
  )
  const totals = React.useMemo(
    () =>
      visibleRows.reduce(
        (acc, row) => {
          acc.added += row.added
          acc.deleted += row.deleted
          return acc
        },
        { added: 0, deleted: 0 }
      ),
    [visibleRows]
  )
  const undoableRunIds = React.useMemo(
    () =>
      Array.from(
        new Set(
          sessionChangeSets
            .filter(
              (changeSet) =>
                changeSet.runId === latestChangeSet?.runId &&
                changeSet.changes.some((change) => change.status === 'open')
            )
            .map((changeSet) => changeSet.runId)
        )
      ),
    [latestChangeSet, sessionChangeSets]
  )
  return {
    t, i18n, sessionView, workingFolder, sshConnectionId,
    activeTab, setActiveTab, selectedChangeKey, setSelectedChangeKey,
    changeSource, setChangeSource,
    runChangesByRunId, refreshSessionRunChanges, undoFileChange, undoRunChanges,
    git, selectedRepoPath, scanRepositories, loadFileDiff,
    stageAll, stageFiles, getStagedDiffBundle,
    diffOpen, setDiffOpen, commitOpen, setCommitOpen,
    commitMessage, setCommitMessage, aiCommitLoading, setAiCommitLoading,
    branchDialog, setBranchDialog, branchValue, setBranchValue,
    busyAction, setBusyAction, fileSearchOpen, setFileSearchOpen,
    fileTreeCommand, setFileTreeCommand,
    requestedRefreshRef, preloadingDiffKeysRef,
    assistantMessageIds, sessionChangeSets, latestChangeSet,
    agentChanges, agentSummaries,
    selectedRepo, repoDetails, status, diffByKey,
    gitRowsBase, gitRows, agentRows, allRows, visibleRows,
    visibleGitRows, visibleStagePaths, totals, undoableRunIds,
    loadGitDiff, branchOptions, canUseCommitComposer, canCommitInline,
    agentSurface, compactSheetSurface
  }
}

export type AgentFilesState = ReturnType<typeof useAgentFiles>
