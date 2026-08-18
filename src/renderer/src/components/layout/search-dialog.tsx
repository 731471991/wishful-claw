import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Search } from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem
} from '@renderer/components/ui/command'
import { useUIStore } from '@renderer/stores/ui-store'
import { useChatStore } from '@renderer/stores/chat-store'
import { formatRelativeTime } from './workspace-sidebar-items'

export interface MessageSearchHit {
  messageId: string
  sessionId: string
  sessionTitle: string
  snippet: string
  createdAt: number
}

const SEARCH_DEBOUNCE_MS = 200
const SEARCH_LIMIT = 50

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps): React.JSX.Element {
  const { t } = useTranslation('layout')
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<MessageSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const navigateToSession = useUIStore((s) => s.navigateToSession)
  const loadRecentSessionMessages = useChatStore((s) => s.loadRecentSessionMessages)

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim().toLowerCase()
    if (!trimmed) {
      setHits([])
      setSearching(false)
      return
    }

    setSearching(true)
    try {
      const res = await window.api.workerRequest<{
        success: boolean
        results: Array<{
          messageId: string
          sessionId: string
          sessionTitle: string
          snippet: string
          createdAt: number
        }>
        error: string | null
      }>('db/messages-search-content', {
        query: trimmed,
        limit: SEARCH_LIMIT
      })
      if (res?.success && res.results) {
        setHits(res.results.map((r) => ({
          messageId: r.messageId,
          sessionId: r.sessionId,
          sessionTitle: r.sessionTitle,
          snippet: r.snippet,
          createdAt: r.createdAt
        })))
      } else {
        setHits([])
      }
    } catch {
      setHits([])
    }
    setSearching(false)
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) {
      setHits([])
      setSearching(false)
      return
    }
    timerRef.current = setTimeout(() => {
      void doSearch(query)
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, doSearch])

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setHits([])
      setSearching(false)
    }
  }, [open])

  const handleSelect = useCallback(
    (sessionId: string) => {
      void loadRecentSessionMessages(sessionId)
      navigateToSession(sessionId)
      onOpenChange(false)
    },
    [loadRecentSessionMessages, navigateToSession, onOpenChange]
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('sidebar.searchLabel', { defaultValue: 'Search' })}
      description={t('sidebar.searchPlaceholder', { defaultValue: 'Search messages…' })}
      showCloseButton={true}
      className="sm:max-w-2xl"
    >
      <CommandInput
        placeholder={t('sidebar.searchPlaceholder', { defaultValue: 'Search messages…' })}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[420px]">
        {searching && hits.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground/60">
            <Search className="size-4 animate-spin" />
            {t('sidebar.searching', { defaultValue: 'Searching…' })}
          </div>
        ) : hits.length === 0 && query.trim() ? (
          <CommandEmpty>
            {t('sidebar.noResultsFor', { defaultValue: 'No results for' })} "{query}"
          </CommandEmpty>
        ) : (
          <CommandGroup heading={t('sidebar.messages', { defaultValue: 'Messages' })}>
            {hits.map((hit) => (
              <CommandItem
                key={hit.messageId}
                value={`${hit.sessionTitle} ${hit.snippet}`}
                onSelect={() => handleSelect(hit.sessionId)}
              >
                <MessageSquare className="size-4 shrink-0 text-muted-foreground/50" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground/90">
                      {hit.sessionTitle || hit.sessionId}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/40">
                      {formatRelativeTime(hit.createdAt)}
                    </span>
                  </div>
                  {hit.snippet && (
                    <p className="line-clamp-1 text-xs text-muted-foreground/70">
                      {hit.snippet}
                    </p>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
