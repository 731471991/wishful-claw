/**
 * Channel / Plugin configuration panel.
 *
 * Tabbed configuration for messaging channel providers:
 *   Tab 1: QR Code binding (scan to connect)
 *   Tab 2: API credentials (descriptor-driven form)
 *   Tab 3: Features & permissions toggles
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import { RefreshCw, QrCode, KeyRound, Settings2, Play, Square, Loader2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { Separator } from '@renderer/components/ui/separator'
import { Badge } from '@renderer/components/ui/badge'
import { Spinner } from '@renderer/components/ui/spinner'
import {
import { QrLoginPanel } from './plugin-panel-qr'
import { CredentialsPanel, FeaturesPanel, ChannelDetailPanel } from './plugin-panel-detail'

function PluginPanel(): React.JSX.Element {
  const { t } = useTranslation('settings')
  const { channels, providers, loading, loadChannels, loadProviders, selectedChannelId, setSelectedChannel } = useChannelStore()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!initialized) {
      void Promise.all([loadChannels(), loadProviders()]).then(() => setInitialized(true))
    }
  }, [initialized, loadChannels, loadProviders])

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) ?? channels[0] ?? null

  return (
    <div className="flex h-full min-h-0">
      {/* Left sidebar: channel list */}
      <div className="flex w-[240px] shrink-0 flex-col border-r">
        <div className="shrink-0 px-3 py-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('channel.list.title', { defaultValue: '渠道列表' })}
          </h2>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {loading && !initialized ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-5" />
            </div>
          ) : channels.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              {t('channel.list.empty', { defaultValue: '暂无渠道配置' })}
            </div>
          ) : (
            channels.map((channel) => {
              const desc = providers.find((p) => p.type === channel.type)
              const isActive = (selectedChannelId ?? channels[0]?.id) === channel.id
              return (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                    isActive
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted/60 text-[10px] font-semibold">
                    {desc?.displayName?.charAt(0) ?? channel.name.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{channel.name}</span>
                  {channel.enabled && (
                    <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      <div className="min-h-0 min-w-0 flex-1">
        {selectedChannel ? (
          <ChannelDetailPanel channel={selectedChannel} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t('channel.empty', { defaultValue: '选择左侧渠道进行配置' })}
          </div>
        )}
      </div>
    </div>
  )
}

export { PluginPanel }
