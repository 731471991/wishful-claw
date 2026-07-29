import { useTranslation } from 'react-i18next'
import { Play, Square, RefreshCw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import type { McpServerStatus } from '@renderer/lib/mcp/types'

export function McpConnectionControl({
  status,
  connecting,
  error,
  onConnect,
  onDisconnect,
  onRefresh
}: {
  status: McpServerStatus
  connecting: boolean
  error?: string
  onConnect: () => void
  onDisconnect: () => void
  onRefresh: () => void
}): React.JSX.Element {
  const { t } = useTranslation('settings')

  return (
    <>
      {/* Connection buttons + status */}
      <section className="flex items-center gap-2 mb-4">
        {status === 'connected' ? (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onDisconnect}>
            <Square className="size-3 mr-1" />
            {t('mcp.disconnect', { defaultValue: 'Disconnect' })}
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs"
            onClick={onConnect}
            disabled={connecting || status === 'connecting'}
          >
            <Play className="size-3 mr-1" />
            {connecting || status === 'connecting'
              ? t('mcp.connecting', { defaultValue: 'Connecting...' })
              : t('mcp.connect', { defaultValue: 'Connect' })}
          </Button>
        )}
        {status === 'connected' && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRefresh}>
            <RefreshCw className="size-3 mr-1" />
            {t('mcp.refresh', { defaultValue: 'Refresh' })}
          </Button>
        )}
        <span
          className={`inline-flex items-center gap-1 text-[10px] ${
            status === 'connected'
              ? 'text-emerald-600 dark:text-emerald-400'
              : status === 'error'
                ? 'text-destructive'
                : status === 'connecting'
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-muted-foreground'
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              status === 'connected'
                ? 'bg-emerald-500'
                : status === 'error'
                  ? 'bg-destructive'
                  : status === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-muted-foreground/30'
            }`}
          />
          {status}
        </span>
      </section>

      {/* Error display */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 mb-4">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </>
  )
}
