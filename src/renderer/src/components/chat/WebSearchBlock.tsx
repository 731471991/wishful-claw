import * as React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Globe, Loader2 } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import type { WebSearchBlock as WebSearchBlockData } from '@renderer/lib/api/types'

/** Best-effort host label for a web search source link (falls back to the raw URL). */
function formatWebSearchHost(url?: string): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Display-only component for a provider-native web search the model ran server-side.
 * Shows a live "searching" state the moment the call starts, then resolves in place to
 * the query (one chip per batched query) plus the consulted sources. The source list can
 * grow tall, so it is collapsed by default behind an expand toggle. Styling follows the
 * shared card + Badge design system (semantic tokens only).
 */
export function WebSearchBlock({ block }: { block: WebSearchBlockData }): React.JSX.Element {
  const { t } = useTranslation('chat')
  const [expanded, setExpanded] = useState(false)
  const isSearching = block.status === 'searching'
  const sources = (block.sources ?? []).filter((s) => !!s.url)
  // A single call can batch several searches (action.queries[]), joined with newlines
  // upstream — render each as its own chip.
  const queries = (block.query ?? '')
    .split('\n')
    .map((q) => q.trim())
    .filter(Boolean)

  return (
    <div className="my-1 max-w-full rounded-lg border border-border/55 bg-background/55 px-3 py-2.5 text-xs dark:border-white/[0.08] dark:bg-[#0d0d0e]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {isSearching ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
        ) : (
          <Globe className="size-3.5 shrink-0 text-primary" />
        )}
        <span className="shrink-0 font-medium text-foreground">
          {isSearching ? t('webSearch.searching') : t('webSearch.label')}
        </span>
        {queries.map((query, i) => (
          <Badge
            key={`${query}-${i}`}
            variant="outline"
            className="max-w-[240px] gap-1 font-normal text-muted-foreground"
            title={query}
          >
            <span className="min-w-0 truncate">{query}</span>
          </Badge>
        ))}
        {sources.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <span>
              {t('webSearch.sources')} ({sources.length})
            </span>
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        )}
      </div>
      {expanded && sources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sources.map((source, i) => (
            <Badge
              key={`${source.url}-${i}`}
              variant="outline"
              asChild
              className="max-w-[220px] gap-1 font-normal text-primary"
            >
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                title={source.title || source.url}
              >
                <Globe className="shrink-0 opacity-70" />
                <span className="min-w-0 truncate">
                  {source.title || formatWebSearchHost(source.url)}
                </span>
              </a>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
