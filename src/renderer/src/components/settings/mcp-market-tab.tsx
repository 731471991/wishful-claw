import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Loader2, Package, Globe, Download } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { toast } from 'sonner'
import { searchMcpServers, isOneClickInstallable } from '@renderer/lib/mcp/mcp-registry'
import type { RegistrySearchResult, RegistryServer } from '@renderer/lib/mcp/mcp-registry'
import { useMcpStore } from '@renderer/stores/mcp-store'
import { McpServerDetail } from './mcp-server-detail'

export function McpMarketTab(): React.JSX.Element {
  const { t } = useTranslation('settings')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<RegistrySearchResult[]>([])
  const [selected, setSelected] = useState<RegistryServer | null>(null)
  const [searched, setSearched] = useState(false)
  const loadedRef = useRef(false)

  const addServer = useMcpStore((s) => s.addServer)

  const handleSearch = useCallback(async (searchQuery?: string) => {
    setLoading(true)
    setSearched(true)
    try {
      const servers = await searchMcpServers(searchQuery ?? query, 30)
      setResults(servers)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(t('mcp.market.searchFailed', { defaultValue: 'Search failed' }), { description: msg })
    } finally {
      setLoading(false)
    }
  }, [query, t])

  // Auto-load popular servers on mount
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    handleSearch('')
  }, [handleSearch])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleInstall = async (server: RegistryServer): Promise<void> => {
    const pkg = server.packages?.[0]
    if (!pkg) {
      // Remote-only server
      const remote = server.remotes?.[0]
      if (!remote) {
        toast.error(t('mcp.market.noInstallablePackage', { defaultValue: 'No installable package' }))
        return
      }
    }

    // Import the conversion function dynamically to avoid circular deps
    const { packageToServerConfig } = await import('@renderer/lib/mcp/mcp-registry')
    const pkgToUse = pkg ?? server.packages?.[0]
    if (!pkgToUse) return

    const config = packageToServerConfig(server, pkgToUse)
    if (!config) {
      toast.error(t('mcp.market.cannotAutoInstall', { defaultValue: 'Cannot auto-install this server' }))
      return
    }

    // If env vars are required, open the detail page for the user to fill them
    const { getRequiredEnvVars } = await import('@renderer/lib/mcp/mcp-registry')
    const requiredVars = getRequiredEnvVars(server)
    if (requiredVars.length > 0) {
      setSelected(server)
      toast.info(t('mcp.market.requiresEnvVars', { defaultValue: 'This server requires configuration' }))
      return
    }

    try {
      await addServer({
        name: config.name,
        description: config.description,
        enabled: true,
        projectId: null,
        transport: config.transport,
        command: config.command,
        args: config.args,
        env: config.env,
        url: config.url,
        headers: config.headers
      })
      toast.success(t('mcp.market.installed', { name: config.name, defaultValue: `Installed "${config.name}"` }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(t('mcp.market.installFailed', { defaultValue: 'Install failed' }), { description: msg })
    }
  }

  if (selected) {
    return (
      <McpServerDetail
        server={selected}
        onBack={() => setSelected(null)}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <div className="relative px-3 py-2 border-b shrink-0">
        <Search className="absolute left-5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('mcp.market.searchPlaceholder', { defaultValue: 'Search MCP servers...' })}
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            {t('mcp.market.searching', { defaultValue: 'Searching...' })}
          </div>
        ) : results.length === 0 ? (
          <div className="px-4 py-12 text-center text-xs text-muted-foreground">
            {searched ? (
              <>
                <p>{t('mcp.market.noResults', { defaultValue: 'No servers found' })}</p>
                <p className="mt-1 text-[10px] opacity-70">
                  {t('mcp.market.noResultsHint', { defaultValue: 'Try a different keyword' })}
                </p>
              </>
            ) : (
              <>
                <Package className="mx-auto mb-2 size-8 opacity-30" />
                <p>{t('mcp.market.searchHint', { defaultValue: 'Search the official MCP Registry' })}</p>
                <p className="mt-1 text-[10px] opacity-70">
                  {t('mcp.market.searchHintDesc', { defaultValue: 'registry.modelcontextprotocol.io' })}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="px-3 py-2">
            {results.map((result, idx) => {
              const server = result.server
              const hasPackage = (server.packages?.length ?? 0) > 0
              const hasRemote = (server.remotes?.length ?? 0) > 0
              const oneClick = isOneClickInstallable(server)
              const title = server.title ?? server.name.split('/').pop() ?? server.name

              return (
                <div
                  key={`${server.name}-${idx}`}
                  className="flex items-start gap-2 rounded-lg border-b px-3 py-3 transition-colors hover:bg-muted/50"
                >
                  <button
                    onClick={() => setSelected(server)}
                    className="flex flex-1 flex-col items-start gap-0.5 text-left min-w-0"
                  >
                    <div className="flex items-center gap-1.5 w-full">
                      {hasPackage ? (
                        <Package className="size-3 shrink-0 text-muted-foreground" />
                      ) : (
                        <Globe className="size-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium truncate">{title}</span>
                      {server.version && (
                        <span className="text-[10px] text-muted-foreground shrink-0">v{server.version}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {server.description ?? t('mcp.market.noDescription', { defaultValue: 'No description' })}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {hasPackage && (
                        <span className="text-[10px] text-muted-foreground">
                          {server.packages![0].runtimeHint ?? server.packages![0].registryType ?? 'package'}
                        </span>
                      )}
                      {hasRemote && (
                        <span className="text-[10px] text-muted-foreground">
                          {server.remotes![0].type}
                        </span>
                      )}
                      {!oneClick && (
                        <span className="text-[10px] text-yellow-600 dark:text-yellow-400">
                          {t('mcp.market.configRequired', { defaultValue: 'config required' })}
                        </span>
                      )}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 shrink-0 mt-0.5"
                    onClick={() => handleInstall(server)}
                    title={t('mcp.market.install', { defaultValue: 'Install' })}
                  >
                    <Download className="size-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
