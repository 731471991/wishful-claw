/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

import { shell } from 'electron'
import { registerMessagePackHandler } from './messagepack-handler'
import type { ExtensionInstance } from '../../shared/extension-types'
import { getMcpManager } from './mcp-handlers'
import { nativeExtensionRequest } from './extension-native-bridge'
import {
  getExtensionAggregateInfo,
  reconcileExtensionSync,
  syncExtensionResources,
  unsyncExtensionResources,
  type ExtensionAggregateInfo
} from './extension-plugin-sync'

type MutationResult = {
  success: boolean
  error?: string
}

type ExtensionUpdateArgs = {
  id: string
  patch: {
    enabled?: boolean
    config?: Record<string, string>
  }
}

type ExtensionAssetArgs = {
  id: string
  path: string
}

type ExtensionStorageGetArgs = {
  extensionId: string
  key: string
}

type ExtensionStorageSetArgs = ExtensionStorageGetArgs & {
  value: unknown
}

type ExtensionPathResult = MutationResult & {
  path?: string
}

function getExtensionId(args: string | { id?: string }): string {
  return typeof args === 'string' ? args : (args.id ?? '')
}

/**
 * Register extension management IPC handlers.
 * Ported from WishfulClaw extension-handlers.ts, adapted for wishful-claw:
 * - Uses getMcpManager() from mcp-handlers instead of parameter injection
 * - Uses registerMessagePackHandler instead of ipcMain.handle
 */
export function registerExtensionHandlers(): void {
  // Converge aggregate resources (MCP servers) with the current
  // enabled state, including changes made while the app was closed.
  void reconcileExtensionSync(getMcpManager())

  registerMessagePackHandler<undefined, ExtensionInstance[]>('extension:list', async () => {
    return await nativeExtensionRequest<ExtensionInstance[]>('extension/list')
  })

  registerMessagePackHandler<{ sourcePath: string }, MutationResult>(
    'extension:install-from-folder',
    async (args) => {
      const result = await nativeExtensionRequest<MutationResult>(
        'extension/install-from-folder',
        args
      )
      if (result.success) await reconcileExtensionSync(getMcpManager())
      return result
    }
  )

  registerMessagePackHandler<ExtensionUpdateArgs, MutationResult & { syncWarnings?: string[] }>(
    'extension:update',
    async (args) => {
      const result = await nativeExtensionRequest<MutationResult>('extension/update', args)
      if (result.success && typeof args.patch.enabled === 'boolean') {
        if (args.patch.enabled) {
          const syncWarnings = await syncExtensionResources(args.id, getMcpManager())
          return syncWarnings.length > 0 ? { ...result, syncWarnings } : result
        }
        await unsyncExtensionResources(args.id, getMcpManager())
      }
      return result
    }
  )

  registerMessagePackHandler<string | { id?: string }, ExtensionAggregateInfo>(
    'extension:aggregate-info',
    async (args) => {
      return await getExtensionAggregateInfo(getExtensionId(args))
    }
  )

  registerMessagePackHandler<string | { id?: string }, MutationResult>(
    'extension:remove',
    async (args) => {
      const id = getExtensionId(args)
      await unsyncExtensionResources(id, getMcpManager())
      return await nativeExtensionRequest<MutationResult>('extension/remove', { id })
    }
  )

  registerMessagePackHandler<string | { id?: string }, MutationResult>(
    'extension:open-folder',
    async (args) => {
      const result = await nativeExtensionRequest<ExtensionPathResult>('extension/resolve-path', {
        id: getExtensionId(args)
      })
      if (!result.success || !result.path) {
        return { success: false, error: result.error ?? 'Extension path not found' }
      }

      const error = await shell.openPath(result.path)
      return error ? { success: false, error } : { success: true }
    }
  )

  registerMessagePackHandler<ExtensionAssetArgs, { content: string } | { error: string }>(
    'extension:read-asset',
    async (args) => {
      return await nativeExtensionRequest<{ content: string } | { error: string }>(
        'extension/read-asset',
        args
      )
    }
  )

  registerMessagePackHandler<ExtensionStorageGetArgs>('extension:storage-get', async (args) => {
    return await nativeExtensionRequest<unknown>('extension/storage-get', args)
  })

  registerMessagePackHandler<ExtensionStorageSetArgs, MutationResult>(
    'extension:storage-set',
    async (args) => {
      return await nativeExtensionRequest<MutationResult>('extension/storage-set', args)
    }
  )

  registerMessagePackHandler<ExtensionStorageGetArgs, MutationResult>(
    'extension:storage-delete',
    async (args) => {
      return await nativeExtensionRequest<MutationResult>('extension/storage-delete', args)
    }
  )
}
