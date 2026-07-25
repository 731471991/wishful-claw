import type React from 'react'
import { Loader2, Wand2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@renderer/components/ui/dialog'
import type { TFunction } from 'i18next'
import type { ChangeRow } from './agent-files-types'

interface CommitDialogProps {
  open: boolean
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>
  commitMessage: string
  setCommitMessage: React.Dispatch<React.SetStateAction<string>>
  busyAction: string | null
  aiCommitLoading: boolean
  selectedRepoPath: string | null
  visibleRows: ChangeRow[]
  totals: { added: number; deleted: number }
  handleGenerateCommitMessage: () => void
  handleCommit: () => void
  t: TFunction
}

/** Commit dialog — stage and commit changes to the selected repository. */
export function CommitDialog(props: CommitDialogProps): React.JSX.Element {
  const {
    open, onOpenChange, commitMessage, setCommitMessage,
    busyAction, aiCommitLoading, selectedRepoPath, visibleRows, totals,
    handleGenerateCommitMessage, handleCommit, t
  } = props

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('agentFiles.commitChanges', { defaultValue: 'Commit Changes' })}
          </DialogTitle>
          <DialogDescription>
            {t('agentFiles.commitDesc', {
              defaultValue: 'Stage the current changes and commit them to the selected repository.'
            })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              placeholder={t('agentFiles.commitPlaceholder', { defaultValue: 'Commit message' })}
              disabled={busyAction !== null || aiCommitLoading}
              className="min-h-[112px] resize-y pr-11 font-mono text-xs"
              rows={5}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1.5 top-1.5 size-8"
              disabled={!selectedRepoPath || visibleRows.length === 0 || busyAction !== null || aiCommitLoading}
              onClick={() => void handleGenerateCommitMessage()}
              title={t('agentFiles.generateCommitMessage', { defaultValue: 'Generate commit message' })}
            >
              {aiCommitLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
            </Button>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-agent-files-muted">
            <span>
              {t('agentFiles.commitScope', {
                count: visibleRows.length,
                defaultValue: '{{count}} change(s) will be staged'
              })}
            </span>
            <span className="font-mono text-agent-files-added">+{totals.added}</span>
            <span className="font-mono text-agent-files-deleted">-{totals.deleted}</span>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busyAction !== null || aiCommitLoading}
            onClick={() => onOpenChange(false)}
          >
            {t('agentFiles.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="outline"
            disabled={!selectedRepoPath || visibleRows.length === 0 || busyAction !== null || aiCommitLoading}
            onClick={() => void handleGenerateCommitMessage()}
          >
            {aiCommitLoading ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('agentFiles.generate', { defaultValue: 'Generate' })}
          </Button>
          <Button
            disabled={!commitMessage.trim() || busyAction !== null || aiCommitLoading}
            onClick={() => void handleCommit()}
          >
            {busyAction === 'commit' ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('agentFiles.commit', { defaultValue: 'Commit' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
