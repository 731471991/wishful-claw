import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'
import type { SystemCommandSnapshot } from './system-command'

export interface CommandCatalogItem {
  name: string
  summary: string
}

export async function listCommands(): Promise<CommandCatalogItem[]> {
  try {
    const result = await ipcClient.invoke(IPC.COMMANDS_LIST)
    return Array.isArray(result) ? (result as CommandCatalogItem[]) : []
  } catch {
    return []
  }
}

export async function loadCommandSnapshot(
  name: string
): Promise<
  { command: SystemCommandSnapshot; summary: string } | { error: string; notFound?: boolean }
> {
  try {
    const result = (await ipcClient.invoke(IPC.COMMANDS_LOAD, { name })) as
      | { name?: string; content?: string; summary?: string; error?: string; notFound?: boolean }
      | undefined

    if (result?.error) {
      return { error: result.error, notFound: result.notFound }
    }

    if (typeof result?.name === 'string' && typeof result?.content === 'string') {
      return {
        command: {
          name: result.name,
          content: result.content
        },
        summary: result.summary ?? ''
      }
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }

  return { error: `Command "${name}" not found` }
}
