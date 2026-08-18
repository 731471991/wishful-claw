import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, MessageSquare } from 'lucide-react'
import { useUIStore } from '@renderer/stores/ui-store'
import { useChatStore } from '@renderer/stores/chat-store'
import { formatRelativeTime } from './workspace-sidebar-items'
import type { MessageSearchHit } from './use-sidebar-search'

interface SidebarSearchResultsProps {
  messageHits: MessageSearchHit[]
  searching: boolean
  query: string
}

export function SidebarSearchResults({
  messageHits,
  searching,
  query
}: SidebarSearchResultsProps): React.JSX.Element {
  const { t } = useTranslation('layout')
  const navigateToSession = useUIStore((s) => s.navigateToSession)
  const loadRecentSessionMessages = useChatStore((s) => s.loadRecentSessionMessages)

  const handleClick = useCallback(
    (sessionId: string) => {
      void loadRecentSessionMessages(sessionId)
      navigateToSession(sessionId)
    },
    [loadRecentSessionMessages, navigateToSession]
  )

  if (searching && messageHits.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground/60">
        <Search className="size-3 animate-spin" />
        {t('sidebar.searching', { defaultValue: 'Searching…' })}
      </div>
    )
  }

  if (messageHits.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-muted-foreground/50">
        {t('sidebar.noResultsFor', { defaultValue: 'No results for' })} "{query}"
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50">
        {t('sidebar.messages', { defaultValue: 'Messages' })} ({messageHits.length})
      </div>
      {messageHits.map((hit) => (
        <button
          key={hit.messageId}
          onClick={() => handleClick(hit.sessionId)}
          className="group flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
        >
          <div className="flex items-center gap-1.5">
            <MessageSquare className="size-3 shrink-0 text-muted-foreground/50" />
            <span className="truncate text-xs font-medium text-foreground/90">
              {hit.sessionTitle || hit.sessionId}
            </span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/40">
              {formatRelativeTime(hit.createdAt)}
            </span>
          </div>
          {hit.snippet && (
            <p className="line-clamp-2 pl-4 text-[11px] text-muted-foreground/70">
              {hit.snippet}
            </p>
          )}
        </button>
      ))}
    </div>
  )
}
