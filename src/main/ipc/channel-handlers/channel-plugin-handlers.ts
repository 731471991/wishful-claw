/**
 * Plugin CRUD + session management + streaming IPC handlers.
 *
 * Extracted from channel-handlers.ts.
 */

import type { ChannelInstance } from '../../channels/channel-types'
import { ChannelManager } from '../../channels/channel-manager'
import {
  activeChannelManager,
  setActiveChannelManager,
  registerChannelMessagePackHandler,
  assertNativeMutation,
  requestNativeDb,
  normalizeQrDisplayUrl,
  buildToolsMap,
  readPlugins,
  writePlugins,
  notifyRenderer,
  isPluginToolEnabledHandler,
  nanoid,
  CHANNEL_PROVIDERS,
  type NativeProjectRow,
  type NativePluginSessionRow,
  type NativePluginSessionMessageRow,
  type NativePluginSessionMutationResult,
  type NativePluginSessionFindResult
} from './channel-handler-utils'
import {
  startWeixinLoginWithQr,
  waitForWeixinLogin,
  DEFAULT_WEIXIN_BASE_URL
} from '../../channels/providers/weixin/weixin-login'

let _handlersRegistered = false

// ── Exported action executors (used by reverse-request dispatch) ──

export async function executePluginAction(args: {
  pluginId: string
  action: string
  params: Record<string, unknown>
}): Promise<unknown> {
  const { pluginId, action, params } = args
  const service = activeChannelManager?.getService(pluginId)
  if (!service) {
    throw new Error(`Plugin ${pluginId} is not running`)
  }

  switch (action) {
    case 'sendMessage': {
      const target = service as typeof service & {
        sendWakeupMessage?: (chatId: string, content: string) => Promise<{ messageId: string }>
      }
      if (params.isWakeup === true && typeof target.sendWakeupMessage === 'function') {
        return await target.sendWakeupMessage(params.chatId as string, params.content as string)
      }
      return await service.sendMessage(params.chatId as string, params.content as string)
    }
    case 'replyMessage':
      return await service.replyMessage(params.messageId as string, params.content as string)
    case 'getGroupMessages':
      return await service.getGroupMessages(params.chatId as string, (params.count as number) ?? 20)
    case 'listGroups':
      return await service.listGroups()
    default:
      throw new Error(`Unknown action: ${action}`)
  }
}

export async function isPluginToolEnabled(pluginId: string, toolName: string): Promise<boolean> {
  return await isPluginToolEnabledHandler(pluginId, toolName)
}

export async function autoStartChannels(channelManager: ChannelManager): Promise<void> {
  const channels = await readPlugins()
  const toStart = channels.filter(
    (p) => p.enabled && (p.features?.autoStart ?? true)
  )
  for (const instance of toStart) {
    try {
      await channelManager.startPlugin(instance, notifyRenderer)
      console.log(`[Channel Manager] Auto-started: ${instance.name} (${instance.type})`)
    } catch (err) {
      console.error(`[Channel Manager] Auto-start failed for ${instance.name}:`, err)
    }
  }
}

// ── Registration ──

export function registerPluginHandlers(channelManager: ChannelManager): void {
  setActiveChannelManager(channelManager)
  if (_handlersRegistered) return
  _handlersRegistered = true

  // List available provider descriptors
  registerChannelMessagePackHandler<undefined>('plugin:list-providers', async () => {
    return CHANNEL_PROVIDERS
  })

  // Weixin QR login
  registerChannelMessagePackHandler<{
    pluginId: string
    baseUrl?: string
    routeTag?: string
    accountId?: string
    force?: boolean
  }>('plugin:weixin:login-start', async (args) => {
    try {
      const result = await startWeixinLoginWithQr({
        accountId: args.accountId,
        apiBaseUrl: args.baseUrl || DEFAULT_WEIXIN_BASE_URL,
        routeTag: args.routeTag,
        force: args.force
      })
      return {
        qrDataUrl: await normalizeQrDisplayUrl(result.qrcodeUrl),
        qrUrl: result.qrcodeUrl,
        message: result.message,
        sessionKey: result.sessionKey
      }
    } catch (err) {
      return {
        message: err instanceof Error ? err.message : String(err),
        sessionKey: args.accountId || ''
      }
    }
  })

  registerChannelMessagePackHandler<{
    pluginId: string
    baseUrl?: string
    routeTag?: string
    sessionKey: string
    timeoutMs?: number
  }>('plugin:weixin:login-wait', async (args) => {
    try {
      return await waitForWeixinLogin({
        sessionKey: args.sessionKey,
        apiBaseUrl: args.baseUrl || DEFAULT_WEIXIN_BASE_URL,
        routeTag: args.routeTag,
        timeoutMs: args.timeoutMs
      })
    } catch (err) {
      return {
        connected: false,
        message: err instanceof Error ? err.message : String(err)
      }
    }
  })

  // List persisted plugin instances
  registerChannelMessagePackHandler<undefined>('plugin:list', async () => {
    const plugins = await readPlugins()
    const projects = await requestNativeDb<NativeProjectRow[]>('db/plugin-normal-projects')
    let changed = false

    if (projects.length === 1) {
      for (const descriptor of CHANNEL_PROVIDERS) {
        const legacyUnbound = plugins.find((p) => p.type === descriptor.type && !p.projectId)
        const hasBoundInstance = plugins.some(
          (p) => p.type === descriptor.type && p.projectId === projects[0].id
        )
        if (legacyUnbound && !hasBoundInstance) {
          legacyUnbound.projectId = projects[0].id
          changed = true
        }
      }
    }

    for (const project of projects) {
      for (const descriptor of CHANNEL_PROVIDERS) {
        const existing = plugins.find(
          (p) => p.type === descriptor.type && p.projectId === project.id
        )
        if (!existing) {
          const config: Record<string, string> = {}
          for (const field of descriptor.configSchema) {
            config[field.key] =
              descriptor.type === 'weixin-official' && field.key === 'baseUrl'
                ? DEFAULT_WEIXIN_BASE_URL
                : ''
          }
          plugins.push({
            id: nanoid(),
            type: descriptor.type,
            name: descriptor.displayName,
            enabled: false,
            builtin: true,
            config,
            createdAt: Date.now(),
            projectId: project.id,
            tools: buildToolsMap(descriptor)
          })
          changed = true
        } else {
          if (!existing.builtin) {
            existing.builtin = true
            changed = true
          }
          if (existing.name !== descriptor.displayName) {
            existing.name = descriptor.displayName
            changed = true
          }
        }
      }
    }

    for (const p of plugins) {
      const desc = CHANNEL_PROVIDERS.find((d) => d.type === p.type)
      if (!desc) continue
      const schemaKeys = new Set(desc.configSchema.map((f) => f.key))
      for (const field of desc.configSchema) {
        if (!(field.key in p.config)) {
          p.config[field.key] =
            desc.type === 'weixin-official' && field.key === 'baseUrl'
              ? DEFAULT_WEIXIN_BASE_URL
              : ''
          changed = true
        }
      }
      if (desc.type === 'weixin-official' && !p.config.baseUrl) {
        p.config.baseUrl = DEFAULT_WEIXIN_BASE_URL
        changed = true
      }
      for (const key of Object.keys(p.config)) {
        if (!schemaKeys.has(key)) {
          delete p.config[key]
          changed = true
        }
      }
      for (const key of Object.keys(p)) {
        if (
          ![
            'id', 'type', 'name', 'enabled', 'builtin', 'config', 'createdAt',
            'projectId', 'tools', 'providerId', 'model', 'features', 'permissions'
          ].includes(key)
        ) {
          delete (p as unknown as Record<string, unknown>)[key]
          changed = true
        }
      }
      const nextTools = buildToolsMap(desc, p.tools)
      if (nextTools && JSON.stringify(nextTools) !== JSON.stringify(p.tools)) {
        p.tools = nextTools
        changed = true
      }
    }

    if (changed) await writePlugins(plugins)
    return plugins
  })

  // Add a new plugin instance
  registerChannelMessagePackHandler<ChannelInstance>('plugin:add', async (instance) => {
    const plugins = await readPlugins()
    const desc = CHANNEL_PROVIDERS.find((d) => d.type === instance.type)
    const nextTools = buildToolsMap(desc, instance.tools)
    plugins.push({ ...instance, ...(nextTools ? { tools: nextTools } : {}) })
    await writePlugins(plugins)
    return { success: true }
  })

  // Update a plugin instance
  registerChannelMessagePackHandler<{ id: string; patch: Partial<ChannelInstance> }>(
    'plugin:update',
    async ({ id, patch }) => {
      const plugins = await readPlugins()
      const idx = plugins.findIndex((p) => p.id === id)
      if (idx === -1) return { success: false, error: 'Plugin not found' }
      const next = { ...plugins[idx], ...patch }
      if ('providerId' in patch && patch.providerId == null) {
        next.model = null
      }
      plugins[idx] = next
      await writePlugins(plugins)

      if ('providerId' in patch || 'model' in patch) {
        try {
          const providerId = next.providerId ?? null
          const modelId = providerId ? (next.model ?? null) : null
          assertNativeMutation(
            await requestNativeDb<NativePluginSessionMutationResult>(
              'db/plugin-sync-session-models',
              { pluginId: id, providerId, modelId }
            ),
            'Sync channel session model'
          )
        } catch (err) {
          console.error('[Channels] Failed to sync channel session model:', err)
        }
      }

      if ('projectId' in patch) {
        try {
          assertNativeMutation(
            await requestNativeDb<NativePluginSessionMutationResult>(
              'db/plugin-sync-session-project',
              { pluginId: id, projectId: next.projectId ?? null }
            ),
            'Sync channel project binding'
          )
        } catch (err) {
          console.error('[Channels] Failed to sync channel project binding:', err)
        }
      }
      return { success: true }
    }
  )

  // Remove a plugin instance
  registerChannelMessagePackHandler<string>('plugin:remove', async (id) => {
    const allPlugins = await readPlugins()
    const target = allPlugins.find((p) => p.id === id)
    if (target?.builtin) {
      return { success: false, error: 'Built-in plugins cannot be removed' }
    }
    await channelManager.stopPlugin(id)
    const plugins = allPlugins.filter((p) => p.id !== id)
    await writePlugins(plugins)
    try {
      assertNativeMutation(
        await requestNativeDb<NativePluginSessionMutationResult>('db/plugin-remove-data', {
          pluginId: id
        }),
        'Remove channel data'
      )
    } catch (err) {
      console.error('[Channels] Failed to cascade-delete sessions:', err)
    }
    return { success: true }
  })

  // Start / Stop / Status
  registerChannelMessagePackHandler<string>('plugin:start', async (id) => {
    const plugins = await readPlugins()
    const instance = plugins.find((p) => p.id === id)
    if (!instance) return { success: false, error: 'Plugin not found' }
    try {
      await channelManager.startPlugin(instance, notifyRenderer)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  registerChannelMessagePackHandler<string>('plugin:stop', async (id) => {
    await channelManager.stopPlugin(id)
    return { success: true }
  })

  registerChannelMessagePackHandler<string>('plugin:status', async (id) => {
    return channelManager.getStatus(id)
  })

  // Unified action dispatch
  registerChannelMessagePackHandler<{
    pluginId: string
    action: string
    params: Record<string, unknown>
  }>('plugin:exec', async ({ pluginId, action, params }) => {
    return await executePluginAction({ pluginId, action, params })
  })

  // ── Plugin Session Management ──

  registerChannelMessagePackHandler<string>('plugin:sessions:list', async (pluginId) => {
    return await requestNativeDb<NativePluginSessionRow[]>('db/plugin-sessions-list', { pluginId })
  })

  registerChannelMessagePackHandler<{
    id: string
    pluginId: string
    title: string
    mode: string
    createdAt: number
    updatedAt: number
    externalChatId?: string
  }>('plugin:sessions:create', async (args) => {
    const plugin = (await readPlugins()).find((item) => item.id === args.pluginId)
    const result = await requestNativeDb<NativePluginSessionMutationResult>(
      'db/plugin-sessions-create',
      {
        ...args,
        projectId: plugin?.projectId ?? null,
        providerId: plugin?.providerId ?? null,
        modelId: plugin?.model ?? null
      }
    )
    if (!result.success) {
      return { success: false, error: result.error || 'Create plugin session failed' }
    }
    return { success: true }
  })

  registerChannelMessagePackHandler<string>('plugin:sessions:find-by-chat', async (externalChatId) => {
    const result = await requestNativeDb<NativePluginSessionFindResult>(
      'db/plugin-sessions-find-by-chat',
      { externalChatId }
    )
    if (!result.success) {
      throw new Error(result.error || 'Find plugin session failed')
    }
    return result.session ?? null
  })

  registerChannelMessagePackHandler<undefined>('plugin:sessions:list-all', async () => {
    return await requestNativeDb<NativePluginSessionRow[]>('db/plugin-sessions-list-all')
  })

  registerChannelMessagePackHandler<{ sessionId: string; limit?: number; offset?: number }>(
    'plugin:sessions:messages',
    async (args) => {
      return await requestNativeDb<NativePluginSessionMessageRow[]>(
        'db/plugin-sessions-messages',
        args as Record<string, unknown>
      )
    }
  )

  registerChannelMessagePackHandler<{ sessionId: string }>('plugin:sessions:clear', async (args) => {
    const result = assertNativeMutation(
      await requestNativeDb<NativePluginSessionMutationResult>(
        'db/plugin-sessions-clear',
        args as Record<string, unknown>
      ),
      'Clear plugin session'
    )
    return { deleted: result.deleted }
  })

  registerChannelMessagePackHandler<{ sessionId: string }>('plugin:sessions:delete', async (args) => {
    assertNativeMutation(
      await requestNativeDb<NativePluginSessionMutationResult>(
        'db/plugin-sessions-delete',
        args as Record<string, unknown>
      ),
      'Delete plugin session'
    )
    const { safeSendMessagePackToAllWindows } = await import('../../window-ipc')
    safeSendMessagePackToAllWindows('plugin:session-deleted', { sessionId: args.sessionId })
    return { ok: true }
  })

  registerChannelMessagePackHandler<{ sessionId: string; title: string }>(
    'plugin:sessions:rename',
    async (args) => {
      assertNativeMutation(
        await requestNativeDb<NativePluginSessionMutationResult>(
          'db/plugin-sessions-rename',
          args as Record<string, unknown>
        ),
        'Rename plugin session'
      )
      return { ok: true }
    }
  )

  // ── Streaming output IPC ──

  const streamHandles = new Map<
    string,
    import('../../channels/channel-types').ChannelStreamingHandle
  >()
  const streamContents = new Map<string, string>()

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
