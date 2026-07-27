/**
 * Weixin-specific IPC handlers (media send).
 *
 * Extracted from channel-handlers.ts.
 */

import type { WeixinService } from '../../channels/providers/weixin/weixin-service'
import {
  activeChannelManager,
  registerChannelMessagePackHandler,
  readBinarySource
} from './channel-handler-utils'

export function registerWeixinHandlers(): void {
  registerChannelMessagePackHandler<{
    pluginId: string
    chatId: string
    filePath: string
    content?: string
  }>('plugin:weixin:send-image', async (args) => {
    const service = activeChannelManager?.getService(args.pluginId) as
      | WeixinService
      | undefined
    if (!service) return { error: 'Weixin plugin not running or not found' }

    try {
      const { buffer } = await readBinarySource(args.filePath, 'image.png')
      const result = await service.sendImage(args.chatId, buffer, args.content)
      return { ok: true, messageId: result.messageId }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  registerChannelMessagePackHandler<{
    pluginId: string
    chatId: string
    filePath: string
    content?: string
  }>('plugin:weixin:send-file', async (args) => {
    const service = activeChannelManager?.getService(args.pluginId) as
      | WeixinService
      | undefined
    if (!service) return { error: 'Weixin plugin not running or not found' }

    try {
      const { buffer, fileName } = await readBinarySource(args.filePath, 'file')
      const result = await service.sendFile(args.chatId, buffer, fileName, args.content)
      return { ok: true, messageId: result.messageId }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })
}

// ── Channel-specific tool executor (used by reverse-request dispatch) ──

export async function executeWeixinChannelTool(
  method: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const pluginId = typeof args.pluginId === 'string' ? args.pluginId : ''
  if (!pluginId) return { error: 'Missing pluginId' }

  const service = activeChannelManager?.getService(pluginId) as WeixinService | undefined

  switch (method) {
    case 'plugin:weixin:send-image': {
      if (!service) return { error: 'Weixin plugin not running or not found' }
      try {
        const { buffer } = await readBinarySource(String(args.filePath ?? ''), 'image.png')
        const result = await service.sendImage(
          String(args.chatId ?? ''),
          buffer,
          typeof args.content === 'string' ? args.content : undefined
        )
        return { ok: true, messageId: result.messageId }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
    case 'plugin:weixin:send-file': {
      if (!service) return { error: 'Weixin plugin not running or not found' }
      try {
        const { buffer, fileName } = await readBinarySource(String(args.filePath ?? ''), 'file')
        const result = await service.sendFile(
          String(args.chatId ?? ''),
          buffer,
          fileName,
          typeof args.content === 'string' ? args.content : undefined
        )
        return { ok: true, messageId: result.messageId }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) }
      }
    }
    default:
      return { error: `Unknown Weixin method: ${method}` }
  }
}
