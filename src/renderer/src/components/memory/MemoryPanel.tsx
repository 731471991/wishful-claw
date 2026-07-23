import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Search, FileText, Archive, Database, RefreshCw } from 'lucide-react'
import {
  memoryStats,
  memorySearch,
  memoryConsolidate,
  type MemoryStats as MemoryStatsType,
  type MemorySearchResult
} from '../../stores/chat-store/memory-helpers'

interface MemoryPanelProps {
  workingFolder?: string | null
}

export function MemoryPanel({ workingFolder }: MemoryPanelProps): React.JSX.Element {
  const [stats, setStats] = React.useState<MemoryStatsType | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<MemorySearchResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const { t } = useTranslation('layout')

  const scope = workingFolder ? 'project' : 'global'

  const refreshStats = React.useCallback(async () => {
    setLoading(true)
    try {
      const s = await memoryStats(scope, workingFolder)
      setStats(s)
    } catch (e) {
      console.error('Failed to load memory stats:', e)
    } finally {
      setLoading(false)
    }
  }, [scope, workingFolder])

  React.useEffect(() => {
    refreshStats()
  }, [refreshStats])

  const handleSearch = React.useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const result = await memorySearch(searchQuery, scope === 'project' ? undefined : 'global', 10)
      setSearchResults(result.hits || [])
    } catch (e) {
      console.error('Memory search failed:', e)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [searchQuery, scope])

  const handleConsolidate = React.useCallback(async () => {
    try {
      await memoryConsolidate(scope, workingFolder)
      await refreshStats()
    } catch (e) {
      console.error('Memory consolidate failed:', e)
    }
  }, [scope, workingFolder, refreshStats])

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('memory.title', { defaultValue: 'Memory' })}</h2>
        <div className="flex gap-2">
          <button
            onClick={handleConsolidate}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title={t('memory.consolidate', { defaultValue: 'Consolidate memory index' })}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={<FileText className="h-4 w-4" />} label={t('memory.hot', { defaultValue: 'Hot' })} value={stats?.hotCount ?? 0} />
        <StatCard icon={<Archive className="h-4 w-4" />} label={t('memory.warm', { defaultValue: 'Warm' })} value={stats?.warmCount ?? 0} />
        <StatCard icon={<Database className="h-4 w-4" />} label={t('memory.cold', { defaultValue: 'Cold' })} value={stats?.coldCount ?? 0} />
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('memory.searchPlaceholder', { defaultValue: 'Search memory...' })}
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || !searchQuery.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
        >
          {searching ? t('memory.searching', { defaultValue: '...' }) : t('memory.search', { defaultValue: 'Search' })}
        </button>
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-2">
          <p className="text-xs text-muted-foreground">{t('memory.matches', { count: searchResults.length, defaultValue: '{{count}} matches' })}</p>
          {searchResults.map((hit, i) => (
            <div key={i} className="rounded-md border border-border p-3 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{hit.title}</span>
                <span className="text-xs text-muted-foreground">
                  {hit.tier} · {hit.scope === 'global' ? 'global' : 'project'}
                </span>
              </div>
              <p className="text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                {hit.content.length > 200 ? hit.content.slice(0, 200) + '...' : hit.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {searchResults.length === 0 && searchQuery && !searching && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          {t('memory.noResults', { defaultValue: 'No matching memory entries found.' })}
        </div>
      )}

      {!searchQuery && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          {loading ? t('memory.loading', { defaultValue: 'Loading...' }) : t('memory.idle', { defaultValue: 'Search memory or use memory tools in chat.' })}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }): React.JSX.Element {
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-xl font-semibold">{value}</span>
    </div>
  )
}
