import type React from 'react'
import {
  Search, X, RefreshCw, MoreHorizontal,
  FilePlus2, FolderPlus, MessageSquarePlus, Copy,
  SquareTerminal, ExternalLink, Code2, FolderOpen
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import type { TFunction } from 'i18next'

interface AgentFileTreeToolbarProps {
  searchQuery: string
  setSearchQuery: (value: string) => void
  loading: boolean
  refreshTree: () => void
  workingFolder: string
  sshConnectionId: string | null
  t: TFunction
  handleNewFile: (parent: string) => void
  handleNewFolder: (parent: string) => void
  handleAddToChat: (path: string) => void
  handleCopyPath: (path: string) => void
  handleOpenTerminal: (path: string, closeOnExit?: boolean) => void
  handleOpenDefault: (path: string) => void
  handleOpenWithCode: (path: string) => void
  handleReveal: (path: string) => void
}

/**
 * Compact toolbar for the agent-surface file tree.
 * Layout: [search input] [refresh] [more dropdown]
 * The "more" dropdown reuses the same actions as the root context menu.
 */
export function AgentFileTreeToolbar({
  searchQuery, setSearchQuery, loading, refreshTree,
  workingFolder, sshConnectionId, t,
  handleNewFile, handleNewFolder,
  handleAddToChat, handleCopyPath,
  handleOpenTerminal, handleOpenDefault, handleOpenWithCode, handleReveal
}: AgentFileTreeToolbarProps): React.JSX.Element {
  return (
    <div className="flex h-[34px] shrink-0 items-center gap-1 border-b border-border/60 bg-background/50 px-2">
      {/* Search input */}
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('fileTree.searchPlaceholder', { defaultValue: 'Search files' })}
          className="h-7 rounded-md border-border/40 bg-muted/30 pl-7 pr-7 text-xs"
        />
        {searchQuery && (
          <button
            type="button"
            className="absolute right-1.5 top-1/2 inline-flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground/60 hover:text-foreground"
            onClick={() => setSearchQuery('')}
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {/* Refresh */}
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 rounded-md"
        onClick={() => { void refreshTree() }}
        disabled={loading}
        title={t('action.refresh', { ns: 'common' })}
      >
        <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
      </Button>

      {/* More dropdown — reuses root context menu actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 rounded-md"
            title={t('action.more', { ns: 'common', defaultValue: 'More' })}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => handleNewFile(workingFolder)}>
            <FilePlus2 className="size-4" />
            {t('fileTree.newFile')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleNewFolder(workingFolder)}>
            <FolderPlus className="size-4" />
            {t('fileTree.newFolder')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => refreshTree()}>
            <RefreshCw className="size-4" />
            {t('action.refresh', { ns: 'common' })}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handleAddToChat(workingFolder)}>
            <MessageSquarePlus className="size-4" />
            {t('fileTree.addToChat')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleCopyPath(workingFolder)}>
            <Copy className="size-4" />
            {t('action.copyPath', { ns: 'common' })}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleOpenTerminal(workingFolder, true)}>
            <SquareTerminal className="size-4" />
            {t('fileTree.openTerminal')}
          </DropdownMenuItem>
          {!sshConnectionId && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => handleOpenDefault(workingFolder)}>
                <ExternalLink className="size-4" />
                {t('fileTree.openDefault')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleOpenWithCode(workingFolder)}>
                <Code2 className="size-4" />
                {t('fileTree.openWithCode')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleReveal(workingFolder)}>
                <FolderOpen className="size-4" />
                {t('fileTree.revealInFinder')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
