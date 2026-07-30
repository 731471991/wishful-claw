import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Cable, Store } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import { useMcpStore } from '@renderer/stores/mcp-store'
import { McpServerConfig as McpServerConfigPanel } from '@renderer/components/settings/mcp-server-config'
import { McpAddDialog } from '@renderer/components/settings/mcp-add-dialog'
import { McpMarketTab } from '@renderer/components/settings/mcp-market-tab'

type TabId = 'installed' | 'market'

export function McpPanel({
  projectId
}: {
  projectId?: string
} = {}): React.JSX.Element {
  const { t } = useTranslation('settings')
  const servers = useMcpStore((s) => s.servers)
  const selectedServerId = useMcpStore((s) => s.selectedServerId)
  const setSelectedServer = useMcpStore((s) => s.setSelectedServer)
  const loadServers = useMcpStore((s) => s.loadServers)
  const serverStatuses = useMcpStore((s) => s.serverStatuses)
  const refreshAllServers = useMcpStore((s) => s.refreshAllServers)

  const [activeTab, setActiveTab] = useState<TabId>('installed')
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    loadServers()
    refreshAllServers()
  }, [loadServers, refreshAllServers])

  useEffect(() => {
    if (!selectedServerId && servers.length > 0) {
      setSelectedServer(servers[0].id)
    }
  }, [selectedServerId, servers, setSelectedServer])

  const projectScopedServers = useMemo(() => {
    if (!projectId) return servers
    return servers.filter((server) => !server.projectId || server.projectId === projectId)
  }, [servers, projectId])

  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return projectScopedServers
    const q = searchQuery.toLowerCase()
    return projectScopedServers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.transport.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
    )
  }, [projectScopedServers, searchQuery])

  const selectedServer = filteredServers.find((s) => s.id === selectedServerId)

  const enabledServers = filteredServers.filter((s) => s.enabled)
  const disabledServers = filteredServers.filter((s) => !s.enabled)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 border-b px-2 py-1.5 shrink-0">
        <button
          onClick={() => setActiveTab('installed')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            activeTab === 'installed'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          )}
        >
          <Cable className="size-3.5" />
          {t('mcp.tabs.installed', { defaultValue: 'Installed' })}
          {servers.length > 0 && (
            <span className="ml-0.5 rounded bg-muted px-1 text-[10px] tabular-nums">
              {servers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('market')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            activeTab === 'market'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          )}
        >
          <Store className="size-3.5" />
          {t('mcp.tabs.market', { defaultValue: 'Market' })}
        </button>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 min-h-0">
        {/* Installed tab */}
        <div className={cn('h-full flex', activeTab !== 'installed' && 'hidden')}>
          {/* Left: Server list */}
          <div className="w-60 shrink-0 border-r flex flex-col xl:w-64">
            {/* Search + Add */}
            <div className="flex items-center gap-1 p-2 border-b">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
                <Input
                  placeholder={t('mcp.searchServers', { defaultValue: 'Search servers...' })}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 pl-7 text-[11px] bg-transparent border-0 shadow-none focus-visible:ring-0"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setDialogOpen(true)}
                title={t('mcp.addServerTitle', { defaultValue: 'Add MCP Server' })}
              >
                <Plus className="size-4" />
              </Button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-1">
              {enabledServers.length > 0 && (
                <div className="px-2 pt-1.5 pb-1">
                  <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider px-1">
                    {t('mcp.enabled', { defaultValue: 'Enabled' })}
                  </p>
                  {enabledServers.map((srv) => {
                    const status = serverStatuses[srv.id] ?? 'disconnected'
                    return (
                      <button
                        key={srv.id}
                        onClick={() => setSelectedServer(srv.id)}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 mt-0.5 text-left transition-colors ${
                          selectedServerId === srv.id
                            ? 'bg-accent text-accent-foreground'
                            : 'text-foreground/80 hover:bg-muted/60'
                        }`}
                      >
                        <Cable className="size-3.5 shrink-0" />
                        <span className="flex-1 truncate text-xs">{srv.name}</span>
                        <span
                          className={`size-1.5 rounded-full shrink-0 ${
                            status === 'connected'
                              ? 'bg-emerald-500'
                              : status === 'error'
                                ? 'bg-destructive'
                                : 'bg-muted-foreground/30'
                          }`}
                        />
                      </button>
                    )
                  })}
                </div>
              )}

              {disabledServers.length > 0 && (
                <div className="px-2 pt-2 pb-1">
                  <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider px-1">
                    {t('mcp.disabled', { defaultValue: 'Disabled' })}
                  </p>
                  {disabledServers.map((srv) => (
                    <button
                      key={srv.id}
                      onClick={() => setSelectedServer(srv.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 mt-0.5 text-left transition-colors ${
                        selectedServerId === srv.id
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      }`}
                    >
                      <Cable className="size-3.5 shrink-0 opacity-50" />
                      <span className="flex-1 truncate text-xs">{srv.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {filteredServers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Cable className="size-8 mb-2 opacity-30" />
                  <p className="text-xs">{t('mcp.noServers', { defaultValue: 'No MCP servers configured' })}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 h-7 text-xs"
                    onClick={() => setActiveTab('market')}
                  >
                    <Store className="size-3 mr-1" />
                    {t('mcp.browseMarket', { defaultValue: 'Browse Market' })}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Config panel */}
          <div className="flex-1 min-w-0 min-h-0">
            {selectedServer ? (
              <McpServerConfigPanel server={selectedServer} projectId={projectId} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t('mcp.selectToConfig', { defaultValue: 'Select a server to configure' })}
              </div>
            )}
          </div>
        </div>

        {/* Market tab */}
        <div className={cn('h-full', activeTab !== 'market' && 'hidden')}>
          <McpMarketTab />
        </div>
      </div>

      <McpAddDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
