import type React from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import type { TFunction } from 'i18next'

interface FileTreeSearchBarProps {
  searchQuery: string
  setSearchQuery: (value: string) => void
  t: TFunction
  agentSurface: boolean
  compactSheetSurface: boolean
  showSearchInput: boolean
}

/** Search input bar for the file tree. */
export function FileTreeSearchBar({
  searchQuery, setSearchQuery, t,
  agentSurface, compactSheetSurface, showSearchInput
}: FileTreeSearchBarProps): React.JSX.Element | null {
  if (!showSearchInput) return null

  return (
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
  )
}
