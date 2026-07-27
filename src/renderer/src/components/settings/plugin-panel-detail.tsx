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
  useChannelStore,
  type PluginInstance,
  type ChannelProviderDescriptor
} from '@renderer/stores/channel-store'
import { cn } from '@renderer/lib/utils'
import { QrLoginPanel } from './plugin-panel-qr'
export function CredentialsPanel({
  channel,
  descriptor
}: {
  channel: PluginInstance
  descriptor: ChannelProviderDescriptor | undefined
}): React.JSX.Element {
  const { t } = useTranslation('settings')
  const { updateChannel } = useChannelStore()
  const [localConfig, setLocalConfig] = useState(channel.config)
  const [saving, setSaving] = useState(false)

  // Sync local config when channel changes
  useEffect(() => {
    setLocalConfig(channel.config)
  }, [channel.id, channel.config])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await updateChannel(channel.id, { config: localConfig })
      toast.success(t('channel.credentials.saved', { defaultValue: '配置已保存' }))
    } catch {
      toast.error(t('channel.credentials.saveFailed', { defaultValue: '保存失败' }))
    } finally {
      setSaving(false)
    }
  }

  if (!descriptor) {
    return <div className="p-4 text-sm text-muted-foreground">Unknown provider type</div>
  }

  return (
    <div className="space-y-4 px-8 py-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">
          {t('channel.credentials.title', { defaultValue: 'API 凭据' })}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{descriptor.description}</p>
      </div>

      <Separator />

      <div className="space-y-3">
        {descriptor.configSchema.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label htmlFor={`field-${field.key}`} className="text-xs font-medium text-foreground">
              {field.label.startsWith('channel.') ? t(field.label, { defaultValue: field.key }) : field.label}
              {field.required && <span className="ml-1 text-red-500">*</span>}
            </label>
            <Input
              id={`field-${field.key}`}
              type={field.type === 'secret' ? 'password' : 'text'}
              value={localConfig[field.key] ?? ''}
              placeholder={field.placeholder}
              onChange={(e) => {
                setLocalConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
              }}
              className="h-8 text-sm"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
          {t('channel.credentials.save', { defaultValue: '保存' })}
        </Button>
      </div>
    </div>
  )
}

// ── Features & Permissions Panel ──

export function FeaturesPanel({ channel }: { channel: PluginInstance }): React.JSX.Element {
  const { t } = useTranslation('settings')
  const { updateChannel } = useChannelStore()

  const features = channel.features ?? { autoReply: true, streamingReply: true, autoStart: true }
  const perms = channel.permissions ?? {
    allowReadHome: false,
    readablePathPrefixes: [],
    allowWriteOutside: false,
    allowShell: false,
    allowSubAgents: false
  }

  const toggleFeature = (key: keyof typeof features, value: boolean): void => {
    void updateChannel(channel.id, {
      features: { ...features, [key]: value }
    })
  }

  const togglePerm = (key: keyof typeof perms, value: boolean): void => {
    void updateChannel(channel.id, {
      permissions: { ...perms, [key]: value }
    })
  }

  const ToggleRow = ({
    label,
    description,
    checked,
    onChange
  }: {
    label: string
    description: string
    checked: boolean
    onChange: (v: boolean) => void
  }): React.JSX.Element => (
    <div className="flex items-center justify-between py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )

  return (
    <div className="space-y-4 px-8 py-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">
          {t('channel.features.title', { defaultValue: '功能与权限' })}
        </h3>
      </div>

      <Separator />

      {/* Feature toggles */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          {t('channel.features.section', { defaultValue: '功能开关' })}
        </p>
        <ToggleRow
          label={t('channel.features.autoReply', { defaultValue: '自动回复' })}
          description={t('channel.features.autoReplyDesc', { defaultValue: '收到消息时自动使用 AI 回复' })}
          checked={features.autoReply}
          onChange={(v) => toggleFeature('autoReply', v)}
        />
        <ToggleRow
          label={t('channel.features.streamingReply', { defaultValue: '流式回复' })}
          description={t('channel.features.streamingReplyDesc', { defaultValue: '实时流式输出回复内容（需要渠道支持）' })}
          checked={features.streamingReply}
          onChange={(v) => toggleFeature('streamingReply', v)}
        />
        <ToggleRow
          label={t('channel.features.autoStart', { defaultValue: '自动启动' })}
          description={t('channel.features.autoStartDesc', { defaultValue: '应用启动时自动连接此渠道' })}
          checked={features.autoStart}
          onChange={(v) => toggleFeature('autoStart', v)}
        />
      </div>

      <Separator />

      {/* Permission toggles */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          {t('channel.permissions.section', { defaultValue: '安全权限' })}
        </p>
        <ToggleRow
          label={t('channel.permissions.allowShell', { defaultValue: 'Shell 执行' })}
          description={t('channel.permissions.allowShellDesc', { defaultValue: '允许 AI 执行 shell 命令' })}
          checked={perms.allowShell}
          onChange={(v) => togglePerm('allowShell', v)}
        />
        <ToggleRow
          label={t('channel.permissions.allowReadHome', { defaultValue: '读取主目录' })}
          description={t('channel.permissions.allowReadHomeDesc', { defaultValue: '允许读取工作目录之外的文件' })}
          checked={perms.allowReadHome}
          onChange={(v) => togglePerm('allowReadHome', v)}
        />
        <ToggleRow
          label={t('channel.permissions.allowWriteOutside', { defaultValue: '外部写入' })}
          description={t('channel.permissions.allowWriteOutsideDesc', { defaultValue: '允许写入工作目录之外的文件' })}
          checked={perms.allowWriteOutside}
          onChange={(v) => togglePerm('allowWriteOutside', v)}
        />
        <ToggleRow
          label={t('channel.permissions.allowSubAgents', { defaultValue: '子代理' })}
          description={t('channel.permissions.allowSubAgentsDesc', { defaultValue: '允许使用子代理工具' })}
          checked={perms.allowSubAgents}
          onChange={(v) => togglePerm('allowSubAgents', v)}
        />
      </div>
    </div>
  )
}

// ── Channel Detail Panel (with tabs) ──

type ConfigTab = 'qr' | 'credentials' | 'features'

export function ChannelDetailPanel({ channel }: { channel: PluginInstance }): React.JSX.Element {
  const { t } = useTranslation('settings')
  const { providers, channelStatuses, startChannel, stopChannel } = useChannelStore()
  const [activeTab, setActiveTab] = useState<ConfigTab>('qr')

  const descriptor = providers.find((p) => p.type === channel.type)
  const status = channelStatuses[channel.id] ?? (channel.enabled ? 'stopped' : 'stopped')
  const supportsQr = channel.type === 'weixin-official' || channel.type === 'feishu-bot'

  const tabs: { id: ConfigTab; label: string; icon: React.ReactNode; show: boolean }[] = [
    {
      id: 'qr',
      label: t('channel.tabs.qr', { defaultValue: '扫码绑定' }),
      icon: <QrCode className="size-3.5" />,
      show: supportsQr
    },
    {
      id: 'credentials',
      label: t('channel.tabs.credentials', { defaultValue: 'API 凭据' }),
      icon: <KeyRound className="size-3.5" />,
      show: true
    },
    {
      id: 'features',
      label: t('channel.tabs.features', { defaultValue: '功能设置' }),
      icon: <Settings2 className="size-3.5" />,
      show: true
    }
  ]

  const visibleTabs = tabs.filter((tab) => tab.show)

  // Auto-switch to first visible tab if current tab is hidden
  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id ?? 'credentials')
    }
  }, [visibleTabs, activeTab])

  const isRunning = status === 'running'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Channel header */}
      <div className="flex shrink-0 items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
            {descriptor?.displayName?.charAt(0) ?? channel.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{channel.name}</span>
              <Badge variant={isRunning ? 'default' : 'secondary'} className="h-4 text-[10px]">
                {isRunning
                  ? t('channel.status.running', { defaultValue: '运行中' })
                  : t('channel.status.stopped', { defaultValue: '已停止' })}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">{descriptor?.description ?? channel.type}</p>
          </div>
        </div>
        <Button
          variant={isRunning ? 'outline' : 'default'}
          size="sm"
          onClick={() => void (isRunning ? stopChannel(channel.id) : startChannel(channel.id))}
        >
          {isRunning ? (
            <>
              <Square className="mr-1.5 size-3" />
              {t('channel.actions.stop', { defaultValue: '停止' })}
            </>
          ) : (
            <>
              <Play className="mr-1.5 size-3" />
              {t('channel.actions.start', { defaultValue: '启动' })}
            </>
          )}
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex shrink-0 gap-1 border-b px-6 py-2">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'qr' && supportsQr && <QrLoginPanel channel={channel} />}
        {activeTab === 'credentials' && (
          <CredentialsPanel channel={channel} descriptor={descriptor} />
        )}
        {activeTab === 'features' && <FeaturesPanel channel={channel} />}
      </div>
    </div>
  )
}

// ── Main PluginPanel ──

