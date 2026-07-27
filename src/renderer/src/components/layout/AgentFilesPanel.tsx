import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useAgentFiles } from './use-agent-files'
import { useAgentFilesActions } from './use-agent-files-actions'
import { FileTreePanel } from '@renderer/components/cowork/FileTreePanel'
import { ChangeDiffDialog } from './change-diff-dialog'
import { AgentFilesEmptyState } from './change-item-row'
import { AgentFilesTitlebar } from './agent-files-titlebar'
import { ChangesTabContent } from './changes-tab-content'
import { CommitDialog } from './commit-dialog'
import { BranchDialog } from './branch-dialog'
import type { AgentFilesTab, AgentFilesChangeSource } from './agent-files-types'

export interface AgentFilesPanelProps {
  sessionId?: string | null
}

export function AgentFilesPanel(props: AgentFilesPanelProps) {
  const state = useAgentFiles(props)
  const actions = useAgentFilesActions(state)
  const { t } = useTranslation('layout')
  const [activeTab, setActiveTab] = React.useState<AgentFilesTab>('changes')
  const [fileSearchOpen, setFileSearchOpen] = React.useState(false)

  const {
    commitMessage, setCommitMessage, commitOpen, setCommitOpen,
    branchDialog, setBranchDialog, branchValue, setBranchValue,
    diffOpen, setDiffOpen, selectedRow, setSelectedChangeKey,
    changeSource, setChangeSource, fileTreeCommand, panelVisible,
    sessionView, git, selectedRepo, status, diffByKey,
    visibleRows, visibleGitRows, gitRows, totals,
    undoableRunIds, selectedRepoPath, branchOptions,
    canCommitInline, canUseCommitComposer, aiCommitLoading, busyAction
  } = state

  const {
    runGitAction, handleCommit, handleGenerateCommitMessage,
    discardGitRows, undoRunChanges, undoAgentRow,
    refreshSessionRunChanges, loadGitDiff, openSelectedDiff,
    sendFileTreeCommand, handleBranchAction
  } = actions

  return (
    <div className="agent-files-panel flex h-full min-h-0 flex-col">
      <AgentFilesTitlebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fileSearchOpen={fileSearchOpen}
        setFileSearchOpen={setFileSearchOpen}
        sendFileTreeCommand={sendFileTreeCommand}
        git={git}
        busyAction={busyAction}
        runGitAction={runGitAction}
        sessionView={sessionView}
        refreshSessionRunChanges={refreshSessionRunChanges}
        setCommitOpen={setCommitOpen}
        t={t}
      />

      {activeTab === 'changes' ? (
        <ChangesTabContent
          commitMessage={commitMessage}
          setCommitMessage={setCommitMessage}
          canCommitInline={canCommitInline}
          canUseCommitComposer={canUseCommitComposer}
          handleCommit={handleCommit}
          handleGenerateCommitMessage={handleGenerateCommitMessage}
          busyAction={busyAction}
          aiCommitLoading={aiCommitLoading}
          git={git}
          selectedRepo={selectedRepo}
          status={status}
          changeSource={changeSource}
          setChangeSource={setChangeSource}
          visibleRows={visibleRows}
          visibleGitRows={visibleGitRows}
          gitRows={gitRows}
          totals={totals}
          selectedRow={selectedRow}
          openSelectedDiff={openSelectedDiff}
          discardGitRows={discardGitRows}
          undoableRunIds={undoableRunIds}
          undoRunChanges={undoRunChanges}
          undoAgentRow={undoAgentRow}
          setCommitOpen={setCommitOpen}
          setBranchDialog={setBranchDialog}
          runGitAction={runGitAction}
          t={t}
        />
      ) : (
        <div className="min-h-0 flex-1 bg-agent-files-panel">
          {sessionView.workingFolder ? (
            <FileTreePanel
              sessionId={sessionView.sessionId}
              surface="agent"
              agentSearchOpen={fileSearchOpen}
              agentCommand={fileTreeCommand}
              watchEnabled={panelVisible && activeTab === 'files'}
            />
          ) : (
            <AgentFilesEmptyState
              title={t('agentFiles.noFolder', { defaultValue: 'No working folder' })}
              description={t('agentFiles.noFolderDesc', {
                defaultValue: 'Select a working folder to browse files.'
              })}
            />
          )}
        </div>
      )}

      <ChangeDiffDialog
        open={diffOpen}
        rows={visibleRows}
        selectedKey={selectedRow?.key ?? null}
        repoPath={git.selectedRepoPath}
        diffByKey={diffByKey}
        onOpenChange={setDiffOpen}
        onSelect={(key) => setSelectedChangeKey(key)}
        onLoadGitDiff={loadGitDiff}
      />

      <CommitDialog
        open={commitOpen}
        onOpenChange={setCommitOpen}
        commitMessage={commitMessage}
        setCommitMessage={setCommitMessage}
        busyAction={busyAction}
        aiCommitLoading={aiCommitLoading}
        selectedRepoPath={selectedRepoPath}
        visibleRows={visibleRows}
        totals={totals}
        handleGenerateCommitMessage={handleGenerateCommitMessage}
        handleCommit={handleCommit}
        t={t}
      />

      <BranchDialog
        branchDialog={branchDialog}
        setBranchDialog={setBranchDialog}
        branchValue={branchValue}
        setBranchValue={setBranchValue}
        branchOptions={branchOptions}
        busyAction={busyAction}
        handleBranchAction={handleBranchAction}
        t={t}
      />
    </div>
  )
}
