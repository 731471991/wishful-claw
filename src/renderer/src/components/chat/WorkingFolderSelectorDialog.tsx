import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Folder, Terminal, Info } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'

interface WorkingFolderSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (folderPath: string) => void
  projectId?: string | null
}

/**
 * Working Folder Selector Dialog
 * - Local folder selection: implemented (uses dialog:openFolder IPC)
 * - SSH folder selection: entry preserved but disabled (迭代四)
 */
export function WorkingFolderSelectorDialog({
  open,
  onOpenChange,
  onSelect
}: WorkingFolderSelectorDialogProps): React.JSX.Element {
  const { t } = useTranslation('chat')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [mode, setMode] = useState<'local' | 'ssh'>('local')

  const handleBrowse = useCallback(async () => {
    try {
      const result = await window.api.invoke<{ folderPath?: string; canceled?: boolean }>('dialog:openFolder', {})
      if (result && result.folderPath && !result.canceled) {
        setSelectedFolder(result.folderPath)
      }
    } catch {
      // dialog:openFolder not registered yet
    }
  }, [])

  const handleConfirm = useCallback(() => {
    if (selectedFolder) {
      onSelect(selectedFolder)
      setSelectedFolder(null)
      onOpenChange(false)
    }
  }, [selectedFolder, onSelect, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t('folderSelector.title', { defaultValue: 'Select Working Folder' })}</DialogTitle>
          <DialogDescription>
            {t('folderSelector.description', { defaultValue: 'Choose a local folder or SSH connection for this project.' })}
          </DialogDescription>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode('local')}
            className={`flex flex-1 items-center gap-2 rounded-lg border p-3 text-xs transition-colors ${
              mode === 'local' ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:bg-accent/30'
            }`}
          >
            <Folder className="size-4" />
            <span>{t('folderSelector.local', { defaultValue: 'Local Folder' })}</span>
          </button>
          <button
            onClick={() => setMode('ssh')}
            disabled
            className={`flex flex-1 cursor-not-allowed items-center gap-2 rounded-lg border p-3 text-xs opacity-50 ${
              mode === 'ssh' ? 'border-primary' : 'border-border'
            }`}
            title={t('folderSelector.sshComingSoon', { defaultValue: 'SSH support coming in 迭代四' })}
          >
            <Terminal className="size-4" />
            <span>{t('folderSelector.ssh', { defaultValue: 'SSH (coming soon)' })}</span>
          </button>
        </div>

        {/* Local folder selection */}
        {mode === 'local' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleBrowse}>
                <Folder className="mr-2 size-3.5" />
                {t('folderSelector.browse', { defaultValue: 'Browse...' })}
              </Button>
              {selectedFolder && (
                <span className="flex-1 truncate text-xs text-muted-foreground" title={selectedFolder}>
                  {selectedFolder}
                </span>
              )}
            </div>

            <div className="flex items-start gap-2 rounded-md bg-muted/30 p-2">
              <Info className="mt-0.5 size-3 shrink-0 text-muted-foreground/60" />
              <p className="text-[11px] text-muted-foreground/70">
                {t('folderSelector.hint', { defaultValue: 'The working folder determines where the agent operates. File operations will be scoped to this directory.' })}
              </p>
            </div>
          </div>
        )}

        {/* SSH placeholder */}
        {mode === 'ssh' && (
          <div className="rounded-md bg-muted/30 p-4 text-center">
            <Terminal className="mx-auto mb-2 size-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground/60">
              {t('folderSelector.sshPlaceholder', { defaultValue: 'SSH connection support will be added in 迭代四.' })}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('folderSelector.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!selectedFolder}>
            {t('folderSelector.confirm', { defaultValue: 'Confirm' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
