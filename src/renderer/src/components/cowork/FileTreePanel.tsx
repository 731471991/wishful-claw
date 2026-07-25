import type React from 'react'
import { useEffect } from 'react'
import {
  FolderPlus, File, Folder, RefreshCw, Search, X,
  ChevronRight, ChevronDown, AlertCircle, Loader2
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import { AnimatePresence, motion } from 'motion/react'
import type { AgentFileTreeCommand } from './file-tree-types'
import { useFileTree } from './use-file-tree'
import { useFileTreeActions } from './use-file-tree-actions'
import { TreeItem, InlineInput } from './tree-item'

interface FileTreePanelProps {
  sessionId?: string | null
  surface?: 'card' | 'sheet' | 'agent'
  agentSearchOpen?: boolean
  agentCommand?: AgentFileTreeCommand | null
  watchEnabled?: boolean
}

export function FileTreePanel({
  sessionId = null,
  surface = 'card',
  agentSearchOpen = false,
  agentCommand = null,
  watchEnabled = true
}: FileTreePanelProps): React.JSX.Element {
  const fileTreeState = useFileTree({ sessionId, surface, agentSearchOpen, watchEnabled })
  const actions = useFileTreeActions(fileTreeState, { agentCommand })
  const {
    t, workingFolder, agentSurface, tree, loading, error,
    searchQuery, setSearchQuery, searchResults, searchLoading,
    agentRootExpanded, setAgentRootExpanded,
    newItemParent, newItemType, handleToggle, handleCollapseAll,
    refreshTree, sshConnectionId
  } = fileTreeState
  const { treeActions, editState, treeStats, activePath } = actions
  const sep = sshConnectionId ? '/' : (workingFolder?.includes('/') ? '/' : '\\')
  const compactSheetSurface = surface === 'sheet' || surface === 'agent'
  const showSearchInput = !agentSurface || agentSearchOpen

  const rootNewItemInput =
    newItemParent === workingFolder ? (
      <InlineInput
        defaultValue={newItemType === 'file' ? 'untitled' : 'new-folder'}
        depth={agentSurface ? 1 : 0}
        icon={
          newItemType === 'file' ? (
            <File className="size-3.5 text-muted-foreground/60" />
          ) : (
            <Folder className="size-3.5 text-amber-400/70" />
          )
        }
        onConfirm={actions.handleNewItemConfirm}
        onCancel={actions.handleNewItemCancel}
      />
    ) : null

  if (!workingFolder) {
    return (
      <div className="workspace-filetree-empty flex flex-col items-center justify-center gap-2 rounded-xl py-8 text-muted-foreground/70">
        <FolderPlus className="size-8" />
        <p className="text-xs">{t('fileTree.selectFolder')}</p>
      </div>
    )
  }



    if (!workingFolder) {
      return (
        <div className="workspace-filetree-empty flex flex-col items-center justify-center gap-2 rounded-xl py-8 text-muted-foreground/70">
          <FolderPlus className="size-8" />
          <p className="text-xs">{t('fileTree.selectFolder')}</p>
        </div>
      )
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div
          className={cn(
            'workspace-filetree-surface flex min-h-0 flex-1 flex-col overflow-hidden',
            agentSurface
              ? 'workspace-filetree-surface--agent'
              : compactSheetSurface
                ? 'workspace-filetree-surface--sheet'
                : 'workspace-filetree-surface--card rounded-[20px]'
          )}
        >
          <div
            className={cn(
              'workspace-filetree-header',
              agentSurface ? 'workspace-filetree-header--agent px-0 py-0' : 'px-3 py-3'
            )}
          >
            {!compactSheetSurface && (
              <>
                <div className="flex items-start gap-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                    <FolderOpen className="size-4 text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="truncate text-sm font-medium text-foreground"
                        title={workingFolder}
                      >
                        {workingFolder.split(/[\\/]/).pop()}
                      </div>
                    </div>
                    <div
                      className="mt-1 truncate text-[11px] text-muted-foreground"
                      title={workingFolder}
                    >
                      {workingFolder}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg"
                      onClick={() => void handleNewFile(workingFolder)}
                      disabled={isSearching}
                      title={t('fileTree.newFile')}
                    >
                      <FilePlus2 className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg"
                      onClick={() => void handleNewFolder(workingFolder)}
                      disabled={isSearching}
                      title={t('fileTree.newFolder')}
                    >
                      <FolderPlus className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg"
                      onClick={handleCollapseAll}
                      disabled={tree.length === 0 || isSearching}
                      title={t('action.showLess', { ns: 'common' })}
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-lg"
                      onClick={() => {
                        void refreshTree()
                      }}
                      disabled={loading}
                      title={t('action.refresh', { ns: 'common' })}
                    >
                      <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="workspace-filetree-chip rounded-full px-2 py-1">
                    {treeStats.folders} {t('unit.folders', { ns: 'common' })}
                  </span>
                  <span className="workspace-filetree-chip rounded-full px-2 py-1">
                    {treeStats.files} {t('unit.files', { ns: 'common' })}
                  </span>
                  {isSearching && (
                    <span className="rounded-full border border-primary/20 bg-primary/8 px-2 py-1 text-primary/80">
                      {searchResults.length} {t('unit.matches', { ns: 'common' })}
                    </span>
                  )}
                </div>
              </>
            )}

            {compactSheetSurface && !agentSurface && (
              <div className="mb-3 flex items-center gap-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                  <FolderOpen className="size-3.5 text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground" title={workingFolder}>
                    {workingFolder.split(/[\\/]/).pop()}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground" title={workingFolder}>
                    {workingFolder}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-lg"
                    onClick={() => void handleNewFile(workingFolder)}
                    disabled={isSearching}
                    title={t('fileTree.newFile')}
                  >
                    <FilePlus2 className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-lg"
                    onClick={() => void handleNewFolder(workingFolder)}
                    disabled={isSearching}
                    title={t('fileTree.newFolder')}
                  >
                    <FolderPlus className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-lg"
                    onClick={() => void refreshTree()}
                    disabled={loading}
                    title={t('action.refresh', { ns: 'common' })}
                  >
                    <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
                  </Button>
                </div>
              </div>
            )}

            {showSearchInput ? (
              <div
                className={cn(
                  'relative',
                  !compactSheetSurface && 'mt-3',
                  agentSurface && 'px-2 py-1'
                )}
              >
                <Search
                  className={cn(
                    'pointer-events-none absolute top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70',
                    agentSurface ? 'left-5' : 'left-3'
                  )}
                />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('fileTree.searchPlaceholder', {
                    defaultValue: 'Search file name or path'
                  })}
                  className={cn(
                    'workspace-filetree-input rounded-xl pl-9 pr-9 text-sm',
                    agentSurface ? 'h-6 rounded-[2px] text-xs' : 'h-9'
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={cn(
                      'workspace-filetree-action absolute top-1/2 inline-flex -translate-y-1/2 items-center justify-center transition-colors',
                      agentSurface ? 'right-3 size-5 rounded-[2px]' : 'right-2 size-6 rounded-md'
                    )}
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {error && (
            <div className="workspace-filetree-header flex items-center gap-1.5 px-3 py-2 text-[11px] text-destructive">
              <AlertCircle className="size-3 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                className={cn(
                  'min-h-0 flex-1 overflow-y-auto text-[12px]',
                  agentSurface ? 'px-0 py-1' : compactSheetSurface ? 'px-3 py-3' : 'px-2 py-2'
                )}
              >
                {loading && tree.length === 0 ? (
                  <div className="flex h-full items-center justify-center py-8">
                    <RefreshCw className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : isSearching ? (
                  searchLoading ? (
                    <div className="workspace-filetree-empty flex items-center gap-2 rounded-xl px-3 py-3 text-xs text-muted-foreground">
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>{t('fileTree.searching', { defaultValue: 'Searching files...' })}</span>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="workspace-filetree-empty workspace-filetree-empty--dashed flex flex-col items-center justify-center gap-2 rounded-xl px-4 py-10 text-center">
                      <Search className="size-5 text-muted-foreground/50" />
                      <div className="text-xs text-muted-foreground">
                        {t('fileTree.noSearchResults', { defaultValue: 'No matching files' })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {searchResults.map((file) => {
                        const isActive = activePath === file.path
                        const relativePath = toRelativePath(file.path, workingFolder)
                        return (
                          <div
                            key={file.path}
                            className={cn(
                              'workspace-filetree-row group flex w-full items-center text-left transition-all',
                              agentSurface
                                ? 'workspace-filetree-row--agent h-[22px] gap-1 rounded-none px-1 py-0'
                                : 'gap-2 rounded-xl px-2.5 py-2',
                              isActive
                                ? 'workspace-filetree-row--active'
                                : 'workspace-filetree-row--interactive'
                            )}
                            onClick={() => handlePreview(file.path)}
                            title={file.path}
                          >
                            {fileIcon(file.name)}
                            <div className="min-w-0 flex-1">
                              <div
                                className={cn(
                                  'truncate',
                                  agentSurface
                                    ? 'text-[12px] font-normal text-agent-files-fg'
                                    : 'text-sm font-medium text-foreground/90'
                                )}
                              >
                                {file.name}
                              </div>
                              {!agentSurface ? (
                                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                  {relativePath}
                                </div>
                              ) : null}
                            </div>
                            <div
                              className={cn(
                                'flex shrink-0 items-center gap-0.5 opacity-0 transition-all group-hover:opacity-100',
                                agentSurface && 'hidden'
                              )}
                            >
                              <button
                                className="workspace-filetree-action rounded-md p-1"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleAddToChat(file.path)
                                }}
                                title={t('fileTree.addToChat')}
                              >
                                <MessageSquarePlus className="size-3" />
                              </button>
                              <button
                                className="workspace-filetree-action rounded-md p-1"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleCopyPath(file.path)
                                }}
                                title={t('fileTree.copyPath')}
                              >
                                <Copy className="size-3" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                ) : tree.length === 0 && !rootNewItemInput ? (
                  <div className="workspace-filetree-empty workspace-filetree-empty--dashed flex flex-col items-center justify-center gap-2 rounded-xl px-4 py-10 text-center">
                    <Folder className="size-5 text-muted-foreground/50" />
                    <div className="text-xs text-muted-foreground">
                      {t('fileTree.empty', { defaultValue: 'No files in current directory' })}
                    </div>
                  </div>
                ) : (
                  <div className={agentSurface ? 'space-y-0' : 'space-y-1'}>
                    {agentSurface ? (
                      <>
                        <div
                          className="workspace-filetree-row workspace-filetree-row--agent workspace-filetree-row--interactive group flex h-[22px] cursor-pointer items-center gap-0 px-0 py-0 text-[12px]"
                          style={{ paddingLeft: 4 }}
                          onClick={() => setAgentRootExpanded((value) => !value)}
                          title={workingFolder}
                        >
                          {agentRootExpanded ? (
                            <ChevronDown className="workspace-filetree-chevron size-4 shrink-0 text-agent-files-icon" />
                          ) : (
                            <ChevronRight className="workspace-filetree-chevron size-4 shrink-0 text-agent-files-icon" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-agent-files-fg">
                            {workingFolder.split(/[\\/]/).pop()}
                          </span>
                        </div>
                        {agentRootExpanded ? (
                          <>
                            {rootNewItemInput}
                            {tree.map((node) => (
                              <TreeItem
                                key={node.path}
                                node={node}
                                depth={1}
                                activePath={activePath}
                                onToggle={handleToggle}
                                editState={editState}
                                actions={treeActions}
                                agentSurface
                              />
                            ))}
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {rootNewItemInput}
                        {tree.map((node) => (
                          <TreeItem
                            key={node.path}
                            node={node}
                            depth={0}
                            activePath={activePath}
                            onToggle={handleToggle}
                            editState={editState}
                            actions={treeActions}
                          />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-52">
              <ContextMenuItem
                className="gap-2 text-xs"
                onSelect={() => handleNewFile(workingFolder)}
              >
                <FilePlus2 className="size-3.5" /> {t('fileTree.newFile')}
              </ContextMenuItem>
              <ContextMenuItem
                className="gap-2 text-xs"
                onSelect={() => handleNewFolder(workingFolder)}
              >
                <FolderPlus className="size-3.5" /> {t('fileTree.newFolder')}
              </ContextMenuItem>
              <ContextMenuItem className="gap-2 text-xs" onSelect={() => refreshTree()}>
                <RefreshCw className="size-3.5" /> {t('action.refresh', { ns: 'common' })}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="gap-2 text-xs"
                onSelect={() => handleAddToChat(workingFolder)}
              >
                <MessageSquarePlus className="size-3.5" /> {t('fileTree.addToChat')}
              </ContextMenuItem>
              <ContextMenuItem
                className="gap-2 text-xs"
                onSelect={() => handleCopyPath(workingFolder)}
              >
                <Copy className="size-3.5" /> {t('action.copyPath', { ns: 'common' })}
              </ContextMenuItem>
              <ContextMenuItem
                className="gap-2 text-xs"
                onSelect={() => handleOpenTerminal(workingFolder, true)}
              >
                <SquareTerminal className="size-3.5" /> {t('fileTree.openTerminal')}
              </ContextMenuItem>
              {!sshConnectionId && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    className="gap-2 text-xs"
                    onSelect={() => handleOpenDefault(workingFolder)}
                  >
                    <ExternalLink className="size-3.5" /> {t('fileTree.openDefault')}
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="gap-2 text-xs"
                    onSelect={() => handleOpenWithCode(workingFolder)}
                  >
                    <Code2 className="size-3.5" /> {t('fileTree.openWithCode')}
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="gap-2 text-xs"
                    onSelect={() => handleReveal(workingFolder)}
                  >
                    <FolderOpen className="size-3.5" /> {t('fileTree.revealInFinder')}
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>

          {!compactSheetSurface && (
            <div className="workspace-filetree-footer px-3 py-2 text-[10px] text-muted-foreground/80">
              {isSearching
                ? t('fileTree.searchHint', {
                    defaultValue: 'Click to preview, or use Add to Chat to insert a file reference'
                  })
                : t('fileTree.stats', {
                    folders: treeStats.folders,
                    files: treeStats.files
                  })}
            </div>
          )}
        </div>
      </div>
    )
  }