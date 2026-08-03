/**
 * Plugin streaming output IPC handlers.
 *
 * Extracted from channel-plugin-handlers.ts for maintainability.
 */

import type { ChannelStreamingHandle } from '../../channels/channel-types'
import { ChannelManager } from '../../channels/channel-manager'
import { registerChannelMessagePackHandler } from './channel-handler-utils'

export function registerPluginStreamHandlers(channelManager: ChannelManager): void {
  const streamHandles = new Map<string, ChannelStreamingHandle>()
  const streamContents = new Map<string, string>()

  // Start a streaming message
  registerChannelMessagePackHandler<{
    pluginId: string
    chatId: string
    streamId?: string
    initialContent: string
    messageId?: string
  }>('plugin:stream:start', async (args) => {
    const service = channelManager.getService(args.pluginId)
    if (!service || !service.supportsStreaming || !service.sendStreamingMessage) {
      return { ok: false, supportsStreaming: false }
    }
    try {
      const handle = await service.sendStreamingMessage(
        args.chatId,
        args.initialContent,
        args.messageId
      )
      const key = args.streamId || `${args.pluginId}:${args.chatId}`
      streamHandles.set(key, handle)
      streamContents.set(key, args.initialContent ?? '')
      return { ok: true, supportsStreaming: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // Update streaming message content (full replace)
  registerChannelMessagePackHandler<{
    pluginId: string
    chatId: string
    streamId?: string
    content: string
  }>('plugin:stream:update', async (args) => {
    const key = args.streamId || `${args.pluginId}:${args.chatId}`
    const handle = streamHandles.get(key)
    if (!handle) return { ok: false }
    try {
      streamContents.set(key, args.content)
      await handle.update(args.content)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })

  // Append delta to streaming message
  registerChannelMessagePackHandler<{
    pluginId: string
    chatId: string
    streamId?: string
    delta: string
  }>('plugin:stream:append', async (args) => {
    const key = args.streamId || `${args.pluginId}:${args.chatId}`
    const handle = streamHandles.get(key)
    if (!handle) return { ok: false }
    try {
      const nextContent = `${streamContents.get(key) ?? ''}${args.delta ?? ''}`
      streamContents.set(key, nextContent)
      await handle.update(nextContent)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })

  // Finish streaming message
  registerChannelMessagePackHandler<{
    pluginId: string
    chatId: string
    streamId?: string
    content: string
  }>('plugin:stream:finish', async (args) => {
    const key = args.streamId || `${args.pluginId}:${args.chatId}`
    const handle = streamHandles.get(key)
    if (!handle) return { ok: false }
    try {
      streamContents.set(key, args.content)
      await handle.finish(args.content)
      streamHandles.delete(key)
      streamContents.delete(key)
      return { ok: true }
    } catch {
      streamHandles.delete(key)
      streamContents.delete(key)
      return { ok: false }
    }
  })
}
