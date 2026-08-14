import type React from 'react'
import {
  ChevronDown, FilePlus2, FolderPlus, GitBranch, GitMerge,
  MoreHorizontal, RefreshCw, Search
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { cn } from '@renderer/lib/utils'
import type { TFunction } from 'i18next'
import type { AgentFilesTab } from '@renderer/stores/ui-types'
import type { AgentFilesState } from './use-agent-files'
import type { AgentFilesActions } from './use-agent-files-actions'

interface AgentFilesTitlebarProps {
  activeTab: AgentFilesTab
  setActiveTab: (tab: AgentFilesTab) => void
  fileSearchOpen: boolean
  setFileSearchOpen: React.Dispatch<React.SetStateAction<boolean>>
  sendFileTreeCommand: (cmd: string) => void
  git: AgentFilesState['git']
  busyAction: string | null
  runGitAction: AgentFilesActions['runGitAction']
  sessionView: AgentFilesState['sessionView']
  refreshSessionRunChanges: (sessionId?: string) => void
  setCommitOpen: React.Dispatch<React.SetStateAction<boolean>>
  t: TFunction
}

/** Titlebar with tabs, action buttons, and overflow dropdown menu. */
export function AgentFilesTitlebar(props: AgentFilesTitlebarProps): React.JSX.Element {
  const {
    activeTab, setActiveTab, fileSearchOpen, setFileSearchOpen,
    sendFileTreeCommand, git, busyAction, runGitAction,
    sessionView, refreshSessionRunChanges, setCommitOpen, t
  } = props

  return (
    <div className="agent-files-titlebar flex h-[34px] shrink-0 items-center justify-between border-b border-agent-files-border bg-agent-files-panel pl-2 pr-1">
      <div className="flex h-full min-w-0 items-center">
        {(['changes', 'files'] as AgentFilesTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={cn('agent-files-tab', activeTab === tab && 'agent-files-tab--active')}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'changes'
              ? t('agentFiles.changes', { defaultValue: 'Changes' })
              : t('agentFiles.files', { defaultValue: 'Files' })}
          </button>
        ))}
      </div>
      <div className="agent-files-titlebar-actions flex shrink-0 items-center gap-0.5">
        {activeTab === 'files' ? (
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn('agent-files-icon-button', fileSearchOpen && 'agent-files-icon-button--active')}
              onClick={() => setFileSearchOpen((value) => !value)}
              title={t('agentFiles.searchFiles', { defaultValue: 'Search files' })}
            >
              <Search className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="agent-files-icon-button"
              onClick={() => sendFileTreeCommand('refresh')}
              title={t('agentFiles.refresh', { defaultValue: 'Refresh' })}
            >
              <RefreshCw className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="agent-files-icon-button"
              onClick={() => sendFileTreeCommand('collapse-all')}
              title={t('agentFiles.collapseAll', { defaultValue: 'Collapse all' })}
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="agent-files-icon-button">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {activeTab === 'files' ? (
              <>
                <DropdownMenuItem onSelect={() => sendFileTreeCommand('new-file')}>
                  <FilePlus2 className="size-4" />
                  {t('agentFiles.newFile', { defaultValue: 'New File' })}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => sendFileTreeCommand('new-folder')}>
                  <FolderPlus className="size-4" />
                  {t('agentFiles.newFolder', { defaultValue: 'New Folder' })}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => sendFileTreeCommand('refresh')}>
                  <RefreshCw className="size-4" />
                  {t('agentFiles.refresh', { defaultValue: 'Refresh' })}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => sendFileTreeCommand('collapse-all')}>
                  <ChevronDown className="size-4" />
                  {t('agentFiles.collapseAll', { defaultValue: 'Collapse all' })}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!git.selectedRepoPath || busyAction !== null}
                  onSelect={() => void runGitAction('pull', () => git.pullRebase(git.selectedRepoPath!))}
                >
                  <GitMerge className="size-4" />
                  {t('agentFiles.pullUpstream', { defaultValue: 'Pull upstream' })}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!git.selectedRepoPath || busyAction !== null}
                  onSelect={() => void runGitAction('fetch', () => git.fetchRepository(git.selectedRepoPath!))}
                >
                  <RefreshCw className="size-4" />
                  {t('agentFiles.fetch', { defaultValue: 'Fetch' })}
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem
                  onSelect={() => {
                    if (git.selectedRepoPath)
                      void git.refreshRepository(git.selectedRepoPath, { force: true })
                    if (sessionView.sessionId)
                      void refreshSessionRunChanges(sessionView.sessionId)
                  }}
                >
                  <RefreshCw className="size-4" />
                  {t('agentFiles.refresh', { defaultValue: 'Refresh' })}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCommitOpen(true)}>
                  {t('agentFiles.commitChanges', { defaultValue: 'Commit Changes' })}
                </DropdownMenuItem>
              </>
            )}
            {activeTab === 'files' && git.repositories.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                {git.repositories.map((repo) => (
                  <DropdownMenuItem
                    key={repo.fullPath}
                    onSelect={() => git.selectRepository(repo.fullPath)}
                  >
                    <GitBranch className="size-4" />
                    <span className="truncate">
                      {repo.relativePath === '.' ? repo.name : repo.relativePath}
                    </span>
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
