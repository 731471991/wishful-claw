import { useState, useEffect, useRef, useCallback } from 'react'
import { type Session, type Project } from '@renderer/stores/chat-store'

export interface MessageSearchHit {
  messageId: string
  sessionId: string
  sessionTitle: string
  snippet: string
  createdAt: number
}

interface SearchResult {
  messageHits: MessageSearchHit[]
  filteredSessions: Session[]
  filteredProjects: Project[]
}

const SEARCH_DEBOUNCE_MS = 200
const SEARCH_LIMIT = 50

/**
 * Sidebar search hook: debounced message content search via DB +
 * in-memory session title / project name filtering.
 */
export function useSidebarSearch(
  sessions: Session[],
  projects: Project[]
): {
  search: string
  setSearch: (v: string) => void
  result: SearchResult | null
  searching: boolean
} {
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(
    async (query: string) => {
      const q = query.trim().toLowerCase()
      if (!q) {
        setResult(null)
        setSearching(false)
        return
      }

      setSearching(true)

      // In-memory filter: session titles + project names
      const filteredSessions = sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.mode ?? '').toLowerCase().includes(q)
      )
      const filteredProjects = projects.filter((p) =>
        p.name.toLowerCase().includes(q)
      )

      // DB search: message content
      let messageHits: MessageSearchHit[] = []
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
          query: q,
          limit: SEARCH_LIMIT
        })
        if (res?.success && res.results) {
          messageHits = res.results.map((r) => ({
            messageId: r.messageId,
            sessionId: r.sessionId,
            sessionTitle: r.sessionTitle,
            snippet: r.snippet,
            createdAt: r.createdAt
          }))
        }
      } catch {
        // ignore — messageHits stays empty
      }

      setResult({ messageHits, filteredSessions, filteredProjects })
      setSearching(false)
    },
    [sessions, projects]
  )

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const q = search.trim()
    if (!q) {
      setResult(null)
      setSearching(false)
      return
    }
    timerRef.current = setTimeout(() => {
      void doSearch(search)
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [search, doSearch])

  return { search, setSearch, result, searching }
}
