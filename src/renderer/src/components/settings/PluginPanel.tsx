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
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'
import { cn } from '@renderer/lib/utils'

// ── QR Code Login Component ──

function QrLoginPanel({ channel }: { channel: PluginInstance }): React.JSX.Element {
  const { t } = useTranslation('settings')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [loginStatus, setLoginStatus] = useState<'idle' | 'loading' | 'waiting' | 'connected' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [generatedQr, setGeneratedQr] = useState<string | null>(null)
  const pollRef = useRef<AbortController | null>(null)
  const { updateChannel } = useChannelStore()

  const isWeixin = channel.type === 'weixin-official'
  const isFeishu = channel.type === 'feishu-bot'

  const startWeixinLogin = useCallback(async () => {
    setLoginStatus('loading')
    setStatusMessage('')
    try {
      const result = (await ipcClient.invoke(IPC.PLUGIN_WEIXIN_LOGIN_START, {
        pluginId: channel.id,
        baseUrl: channel.config.baseUrl || undefined,
        routeTag: channel.config.routeTag || undefined,
        accountId: channel.config.accountId || undefined,
        force: true
      })) as { qrDataUrl?: string; qrUrl?: string; message?: string; sessionKey?: string }

      if (result.qrDataUrl) {
        setQrDataUrl(result.qrDataUrl)
        setLoginStatus('waiting')
        setStatusMessage(t('channel.qr.waiting', { defaultValue: '请使用微信扫描二维码' }))

        // Poll for login status
        pollRef.current = new AbortController()
        const poll = async (): Promise<void> => {
          try {
            const waitResult = (await ipcClient.invoke(IPC.PLUGIN_WEIXIN_LOGIN_WAIT, {
              pluginId: channel.id,
              baseUrl: channel.config.baseUrl || undefined,
              routeTag: channel.config.routeTag || undefined,
              sessionKey: result.sessionKey || '',
              timeoutMs: 30000
            })) as { connected?: boolean; message?: string; botToken?: string; userId?: string; baseUrl?: string }

            if (waitResult.connected) {
              setLoginStatus('connected')
              setStatusMessage(t('channel.qr.connected', { defaultValue: '绑定成功!' }))

              // Save token and user info to channel config
              const patch: Partial<PluginInstance> = {
                config: {
                  ...channel.config,
                  token: waitResult.botToken || channel.config.token,
                  userId: waitResult.userId || channel.config.userId,
                  baseUrl: waitResult.baseUrl || channel.config.baseUrl
                },
                enabled: true
              }
              await updateChannel(channel.id, patch)
              toast.success(t('channel.qr.connected', { defaultValue: '绑定成功!' }))
              return
            }

            if (pollRef.current?.signal.aborted) return
            // Continue polling
            setStatusMessage(waitResult.message || t('channel.qr.waiting', { defaultValue: '等待扫描...' }))
            void poll()
          } catch {
            if (!pollRef.current?.signal.aborted) {
              setLoginStatus('error')
              setStatusMessage(t('channel.qr.expired', { defaultValue: '二维码已过期，请刷新' }))
            }
          }
        }
        void poll()
      } else {
        setLoginStatus('error')
        setStatusMessage(result.message || t('channel.qr.failed', { defaultValue: '获取二维码失败' }))
      }
    } catch (err) {
      setLoginStatus('error')
      setStatusMessage(err instanceof Error ? err.message : String(err))
    }
  }, [channel, t, updateChannel])

  // Generate QR code for Feishu (encodes bot info URL)
  const generateFeishuQr = useCallback(async () => {
    const appId = channel.config.appId
    if (!appId) {
      setStatusMessage(t('channel.qr.noAppId', { defaultValue: '请先在 API 凭据页填写 App ID' }))
      return
    }
    try {
      const botUrl = `https://open.feishu.cn/app/${appId}`
      const dataUrl = await QRCode.toDataURL(botUrl, { width: 240, margin: 2 })
      setGeneratedQr(dataUrl)
      setStatusMessage(t('channel.qr.feishuHint', { defaultValue: '扫描二维码在飞书中打开应用' }))
    } catch {
      setStatusMessage(t('channel.qr.failed', { defaultValue: '生成二维码失败' }))
    }
  }, [channel.config.appId, t])

  useEffect(() => {
    return () => {
      pollRef.current?.abort()
    }
  }, [])

  // Auto-generate Feishu QR if appId exists
  useEffect(() => {
    if (isFeishu && channel.config.appId && !generatedQr) {
      void generateFeishuQr()
    }
  }, [isFeishu, channel.config.appId, generatedQr, generateFeishuQr])

  if (!isWeixin && !isFeishu) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t('channel.qr.notSupported', { defaultValue: '此渠道不支持扫码绑定，请使用 API 凭据配置' })}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 px-8 py-6">
      <h3 className="text-sm font-medium text-foreground">
        {t('channel.qr.title', { defaultValue: '扫码绑定' })}
      </h3>

      {/* QR Code display */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex size-[240px] items-center justify-center rounded-lg border-2 border-dashed border-border bg-white p-2">
          {isWeixin ? (
            qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="size-full object-contain" />
            ) : loginStatus === 'loading' ? (
              <Spinner className="size-8" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <QrCode className="size-12 opacity-30" />
                <span className="text-xs">{t('channel.qr.placeholder', { defaultValue: '点击下方按钮获取二维码' })}</span>
              </div>
            )
          ) : isFeishu ? (
            generatedQr ? (
              <img src={generatedQr} alt="Feishu Bot QR" className="size-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <QrCode className="size-12 opacity-30" />
                <span className="text-xs">{statusMessage || t('channel.qr.feishuPlaceholder', { defaultValue: '填写 App ID 后生成二维码' })}</span>
              </div>
            )
          ) : null}

          {/* Loading overlay */}
          {loginStatus === 'waiting' && qrDataUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
        </div>

        {/* Status message */}
        {statusMessage && (
          <p className={cn(
            'text-xs',
            loginStatus === 'connected' ? 'text-green-600' : loginStatus === 'error' ? 'text-red-500' : 'text-muted-foreground'
          )}>
            {statusMessage}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {isWeixin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void startWeixinLogin()}
            disabled={loginStatus === 'loading'}
          >
            {loginStatus === 'loading' ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-3.5" />
            )}
            {loginStatus === 'waiting'
              ? t('channel.qr.refresh', { defaultValue: '刷新二维码' })
              : t('channel.qr.start', { defaultValue: '获取二维码' })}
          </Button>
        )}
        {isFeishu && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void generateFeishuQr()}
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            {t('channel.qr.regenerate', { defaultValue: '重新生成' })}
          </Button>
        )}
      </div>

      {/* Instructions */}
      <div className="max-w-sm rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        {isWeixin ? (
          <p>{t('channel.qr.weixinInstructions', { defaultValue: '1. 点击"获取二维码"按钮\n2. 使用微信扫描显示的二维码\n3. 在手机上确认授权\n4. 绑定成功后渠道将自动启用' })}</p>
        ) : (
          <p>{t('channel.qr.feishuInstructions', { defaultValue: '1. 先在"API 凭据"页填写 App ID 和 App Secret\n2. 返回此页面查看生成的二维码\n3. 扫描二维码可快速跳转到飞书应用管理页\n4. 确保机器人已发布并具有所需权限' })}</p>
        )}
      </div>
    </div>
  )
}

// ── API Credentials Form ──

function CredentialsPanel({
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
              {field.label}
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

function FeaturesPanel({ channel }: { channel: PluginInstance }): React.JSX.Element {
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

function ChannelDetailPanel({ channel }: { channel: PluginInstance }): React.JSX.Element {
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
