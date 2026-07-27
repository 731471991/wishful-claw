// Save logic extracted from PreviewPanel

import type { PreviewPanelTab } from '@renderer/stores/preview-panel-helpers'
import { useUIStore } from '@renderer/stores/ui-store'
import { useGitStore } from '@renderer/stores/git-store'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'

interface UsePreviewSaveOptions {
  activeTab: PreviewPanelTab | null
  content: string
  setContent: (value: string) => void
}

export function usePreviewSave({ activeTab, content, setContent }: UsePreviewSaveOptions) {
  const updatePreviewTab = useUIStore((s) => s.updatePreviewTab)

  const saveTab = async (tab: PreviewPanelTab): Promise<boolean> => {
    const isEditableDiff = tab.source === 'diff' && Boolean(tab.diffModifiedEditable)
    if ((tab.source !== 'file' && !isEditableDiff) || !tab.filePath) return false

    const tabContent = isEditableDiff
      ? (tab.draftContent ?? tab.diffModified ?? '')
      : tab.id === activeTab?.id
        ? content
        : tab.draftContent
    if (tabContent === undefined) return false

    try {
      const channel = tab.sshConnectionId ? IPC.SSH_FS_WRITE_FILE : IPC.FS_WRITE_FILE
      const args = tab.sshConnectionId
        ? { connectionId: tab.sshConnectionId, path: tab.filePath, content: tabContent }
        : { path: tab.filePath, content: tabContent }
      await ipcClient.invoke(channel, args)
      if (isEditableDiff) {
        // The on-disk file now matches the modified side; refresh git state so
        // the SCM list and any cached diff reflect the save.
        updatePreviewTab(tab.id, {
          draftContent: undefined,
          modified: false,
          diffModified: tabContent
        })
        if (tab.gitRepoPath) {
          useGitStore.getState().invalidateFileDiff(tab.gitRepoPath, tab.filePath)
          void useGitStore.getState().refreshRepository(tab.gitRepoPath, { force: true })
        }
      } else {
        if (tab.id === activeTab?.id) setContent(tabContent)
        updatePreviewTab(tab.id, {
          draftContent: undefined,
          modified: false
        })
      }
      return true
    } catch (err) {
      console.error('[PreviewPanel] Save failed:', err)
      return false
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!activeTab) return
    await saveTab(activeTab)
  }

  return { saveTab, handleSave }
}
