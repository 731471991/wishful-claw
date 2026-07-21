import { IPC } from './ipc/channels'
import { ipcClient } from './ipc/ipc-client'

type DefaultChatWorkingFolderResult = {
  path?: string
  error?: string
}

export async function ensureDefaultChatWorkingFolder(): Promise<string | undefined> {
  const result = (await ipcClient.invoke(
    IPC.FS_DEFAULT_CHAT_WORKING_FOLDER
  )) as DefaultChatWorkingFolderResult

  if (result?.path?.trim()) {
    return result.path
  }

  if (result?.error) {
    console.warn('[ChatWorkingFolder] Failed to prepare default chat working folder:', result.error)
  }

  return undefined
}
