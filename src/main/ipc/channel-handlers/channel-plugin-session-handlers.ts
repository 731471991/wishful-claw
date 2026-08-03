/**
 * Plugin session management IPC handlers.
 *
 * Extracted from channel-plugin-handlers.ts for maintainability.
 */

import {
  registerChannelMessagePackHandler,
  assertNativeMutation,
  requestNativeDb,
  readPlugins,
  type NativePluginSessionRow,
  type NativePluginSessionMessageRow,
  type NativePluginSessionMutationResult,
  type NativePluginSessionFindResult
} from './channel-handler-utils'
import { safeSendMessagePackToAllWindows } from '../../window-ipc'

export function registerPluginSessionHandlers(): void {
  // List sessions for a plugin
  registerChannelMessagePackHandler<string>('plugin:sessions:list', async (pluginId) => {
    return await requestNativeDb<NativePluginSessionRow[]>('db/plugin-sessions-list', { pluginId })
  })

  // Create a new plugin session
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
        projectId: null,
        providerId: plugin?.providerId ?? null,
        modelId: plugin?.model ?? null
      }
    )
    if (!result.success) {
      return { success: false, error: result.error || 'Create plugin session failed' }
    }
    return { success: true }
  })

  // Find session by external chat ID
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

  // List all plugin sessions
  registerChannelMessagePackHandler<undefined>('plugin:sessions:list-all', async () => {
    return await requestNativeDb<NativePluginSessionRow[]>('db/plugin-sessions-list-all')
  })

  // List messages in a plugin session
  registerChannelMessagePackHandler<{ sessionId: string; limit?: number; offset?: number }>(
    'plugin:sessions:messages',
    async (args) => {
      return await requestNativeDb<NativePluginSessionMessageRow[]>(
        'db/plugin-session-messages-list',
        args as Record<string, unknown>
      )
    }
  )

  // Clear all messages in a plugin session
  registerChannelMessagePackHandler<{ sessionId: string }>('plugin:sessions:clear', async (args) => {
    const result = assertNativeMutation(
      await requestNativeDb<NativePluginSessionMutationResult>(
        'db/plugin-session-messages-clear',
        args as Record<string, unknown>
      ),
      'Clear plugin session'
    )
    return { deleted: result.deleted }
  })

  // Delete a plugin session
  registerChannelMessagePackHandler<{ sessionId: string }>('plugin:sessions:delete', async (args) => {
    assertNativeMutation(
      await requestNativeDb<NativePluginSessionMutationResult>(
        'db/plugin-session-delete',
        args as Record<string, unknown>
      ),
      'Delete plugin session'
    )
    safeSendMessagePackToAllWindows('plugin:session-deleted', { sessionId: args.sessionId })
    return { ok: true }
  })

  // Rename a plugin session
  registerChannelMessagePackHandler<{ sessionId: string; title: string }>(
    'plugin:sessions:rename',
    async (args) => {
      assertNativeMutation(
        await requestNativeDb<NativePluginSessionMutationResult>(
          'db/plugin-session-rename',
          args as Record<string, unknown>
        ),
        'Rename plugin session'
      )
      return { ok: true }
    }
  )
}
