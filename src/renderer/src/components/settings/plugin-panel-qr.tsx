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
  type PluginInstance
} from '@renderer/stores/channel-store'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'
import { cn } from '@renderer/lib/utils'
import {
  useChannelStore,
  type PluginInstance
} from '@renderer/stores/channel-store'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'
import { cn } from '@renderer/lib/utils'
export function QrLoginPanel({ channel }: { channel: PluginInstance }): React.JSX.Element {
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
                  token: waitResult.token || channel.config.token,
                  userId: waitResult.userId || channel.config.userId,
                  baseUrl: waitResult.baseUrl || channel.config.baseUrl,
                  accountId: waitResult.accountId || channel.config.accountId
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

