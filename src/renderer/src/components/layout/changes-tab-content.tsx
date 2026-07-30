import type React from 'react'
import {
  Check, ChevronDown, FileCode, GitBranch, GitMerge, Loader2,
  RefreshCw, RotateCcw, Trash2, Wand2
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import type { TFunction } from 'i18next'
import type { AgentFilesChangeSource } from '@renderer/stores/ui-types'
import type { ChangeRow } from './agent-files-types'
import { ChangeItemRow, AgentFilesEmptyState } from './change-item-row'
import type { AgentFilesState } from './use-agent-files'
import type { AgentFilesActions } from './use-agent-files-actions'

interface ChangesTabContentProps {
  commitMessage: string
  setCommitMessage: React.Dispatch<React.SetStateAction<string>>
  canCommitInline: boolean
  canUseCommitComposer: boolean
  handleCommit: () => void
  handleGenerateCommitMessage: () => void
  busyAction: string | null
  aiCommitLoading: boolean
  git: AgentFilesState['git']
  selectedRepo: AgentFilesState['selectedRepo']
  status: AgentFilesState['status']
  changeSource: AgentFilesChangeSource
  setChangeSource: (source: AgentFilesChangeSource) => void
  visibleRows: ChangeRow[]
  visibleGitRows: ChangeRow[]
  gitRows: ChangeRow[]
  totals: { added: number; deleted: number }
  selectedRow: ChangeRow | null
  openSelectedDiff: (row: ChangeRow) => void
  discardGitRows: AgentFilesActions['discardGitRows']
  undoableRunIds: string[]
  undoRunChanges: AgentFilesActions['undoRunChanges']
  undoAgentRow: AgentFilesActions['undoAgentRow']
  setCommitOpen: React.Dispatch<React.SetStateAction<boolean>>
  setBranchDialog: React.Dispatch<React.SetStateAction<'merge' | 'checkout' | null>>
  runGitAction: AgentFilesActions['runGitAction']
  t: TFunction
}

/** Changes tab: commit composer + filter bar + change list. */
export function ChangesTabContent(props: ChangesTabContentProps): React.JSX.Element {
  const {
    commitMessage, setCommitMessage, canCommitInline, canUseCommitComposer,
    handleCommit, handleGenerateCommitMessage, busyAction, aiCommitLoading,
    git, selectedRepo, status, changeSource, setChangeSource,
    visibleRows, visibleGitRows, gitRows, totals, selectedRow,
    openSelectedDiff, discardGitRows, undoableRunIds, undoRunChanges, undoAgentRow,
    setCommitOpen, setBranchDialog, runGitAction, t
  } = props

  return (
    <>
      <div className="shrink-0 border-b border-agent-files-border bg-agent-files-panel px-2 pb-2 pt-1">
        <div className="relative">
          <Textarea
            value={commitMessage}
            onChange={(event) => setCommitMessage(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault()
                if (canCommitInline) void handleCommit()
              }
            }}
            placeholder={t('agentFiles.commitPlaceholder', { defaultValue: 'Commit message' })}
            disabled={busyAction !== null || aiCommitLoading}
            className="min-h-[54px] resize-none rounded-[2px] border-agent-files-border bg-agent-files-panel px-2 py-1.5 pr-9 text-xs shadow-none focus-visible:ring-1"
            rows={2}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="agent-files-icon-button absolute right-1 top-1 size-6"
            disabled={!canUseCommitComposer}
            onClick={() => void handleGenerateCommitMessage()}
            title={t('agentFiles.generateCommitMessage', { defaultValue: 'Generate commit message' })}
          >
            {aiCommitLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          </Button>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            className="agent-files-primary-button h-6 min-w-0 flex-1 px-2 text-xs"
            disabled={!canCommitInline}
            onClick={() => void handleCommit()}
          >
            {busyAction === 'commit' ? <Loader2 className="size-3.5 animate-spin" /> : <GitMerge className="size-3.5" />}
            {t('agentFiles.commitChanges', { defaultValue: 'Commit Changes' })}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                className="agent-files-primary-button h-6 w-6"
                disabled={!git.selectedRepoPath || busyAction !== null}
              >
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => setCommitOpen(true)}>
                <Check className="size-4" />
                {t('agentFiles.commitChanges', { defaultValue: 'Commit Changes' })}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => void runGitAction('stage', () => git.stageAll(git.selectedRepoPath!))}
              >
                <FileCode className="size-4" />
                {t('agentFiles.stageAll', { defaultValue: 'Stage All' })}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => void runGitAction('unstage', () => git.unstageAll(git.selectedRepoPath!))}
              >
                <RotateCcw className="size-4" />
                {t('agentFiles.unstageAll', { defaultValue: 'Unstage All' })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setBranchDialog('merge')}>
                <GitMerge className="size-4" />
                {t('agentFiles.mergeBranch', { defaultValue: 'Merge Branch...' })}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setBranchDialog('checkout')}>
                <GitBranch className="size-4" />
                {t('agentFiles.checkoutBranch', { defaultValue: 'Checkout Branch...' })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => void discardGitRows(visibleGitRows.length > 0 ? visibleGitRows : gitRows)}
              >
                <Trash2 className="size-4" />
                {t('agentFiles.discardChanges', { defaultValue: 'Discard Changes' })}
              </DropdownMenuItem>
              {undoableRunIds.length > 0 ? (
                <DropdownMenuItem
                  onSelect={() => { for (const runId of undoableRunIds) void undoRunChanges(runId) }}
                >
                  <RotateCcw className="size-4" />
                  {t('agentFiles.undoAgentChanges', { defaultValue: 'Undo Agent Changes' })}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => { if (git.selectedRepoPath) void git.refreshRepository(git.selectedRepoPath, { force: true }) }}
              >
                <RefreshCw className="size-4" />
                {t('agentFiles.refresh', { defaultValue: 'Refresh' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-2 flex h-[22px] items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="agent-files-branch-filter flex min-w-0 items-center gap-1">
                <span className="truncate">
                  {changeSource === 'all'
                    ? t('agentFiles.branchChanges', { defaultValue: 'Branch Changes' })
                    : changeSource === 'agent'
                      ? t('agentFiles.agentChanges', { defaultValue: 'Agent Changes' })
                      : t('agentFiles.gitChanges', { defaultValue: 'Git Changes' })}
                </span>
                <ChevronDown className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {(['all', 'agent', 'git'] as AgentFilesChangeSource[]).map((source) => (
                <DropdownMenuItem key={source} onSelect={() => setChangeSource(source)}>
                  {source === 'all'
                    ? t('agentFiles.branchChanges', { defaultValue: 'Branch Changes' })
                    : source === 'agent'
                      ? t('agentFiles.agentChanges', { defaultValue: 'Agent Changes' })
                      : t('agentFiles.gitChanges', { defaultValue: 'Git Changes' })}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="agent-files-count-badge ml-auto">{visibleRows.length}</span>
          <span className="font-mono text-[11px] leading-none text-agent-files-added">+{totals.added}</span>
          <span className="font-mono text-[11px] text-agent-files-deleted">-{totals.deleted}</span>
        </div>
        {selectedRepo ? (
          <div className="mt-1 truncate text-[11px] text-agent-files-muted">
            {status?.branch ?? selectedRepo.branch}
            {status?.upstream ? ` · ${status.upstream}` : ''}
          </div>
        ) : git.scanError ? (
          <div className="mt-1 truncate text-[11px] text-destructive">{git.scanError}</div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-agent-files-panel py-1">
        {git.isScanning && visibleRows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-agent-files-muted">
            <Loader2 className="mr-2 size-4 animate-spin" />
            {t('agentFiles.scanning', { defaultValue: 'Scanning changes...' })}
          </div>
        ) : visibleRows.length === 0 ? (
          <AgentFilesEmptyState
            title={t('agentFiles.noChanges', { defaultValue: 'No changes' })}
            description={t('agentFiles.noChangesDesc', {
              defaultValue: 'Agent edits and Git changes for this workspace will appear here.'
            })}
          />
        ) : (
          visibleRows.map((row) => (
            <ChangeItemRow
              key={row.key}
              row={row}
              selected={row.key === selectedRow?.key}
              onSelect={() => openSelectedDiff(row)}
              onDiscard={() => row.source === 'git' && void discardGitRows([row])}
              onUndo={() => row.source === 'agent' && void undoAgentRow(row)}
            />
          ))
        )}
      </div>
    </>
  )
}

