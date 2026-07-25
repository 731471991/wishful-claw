import type React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@renderer/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@renderer/components/ui/select'
import type { TFunction } from 'i18next'
import { branchItemLabel } from './agent-files-utils'
import type { GitBranchItem } from '@renderer/stores/git-store'

interface BranchDialogProps {
  branchDialog: 'merge' | 'checkout' | null
  setBranchDialog: React.Dispatch<React.SetStateAction<'merge' | 'checkout' | null>>
  branchValue: string
  setBranchValue: React.Dispatch<React.SetStateAction<string>>
  branchOptions: GitBranchItem[]
  busyAction: string | null
  handleBranchAction: () => void
  t: TFunction
}

/** Branch action dialog — merge or checkout. */
export function BranchDialog(props: BranchDialogProps): React.JSX.Element {
  const {
    branchDialog, setBranchDialog, branchValue, setBranchValue,
    branchOptions, busyAction, handleBranchAction, t
  } = props

  return (
    <Dialog open={branchDialog !== null} onOpenChange={(open) => !open && setBranchDialog(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {branchDialog === 'merge'
              ? t('agentFiles.mergeBranch', { defaultValue: 'Merge Branch...' })
              : t('agentFiles.checkoutBranch', { defaultValue: 'Checkout Branch...' })}
          </DialogTitle>
          <DialogDescription>
            {t('agentFiles.branchActionDesc', {
              defaultValue: 'Choose a branch from the selected repository.'
            })}
          </DialogDescription>
        </DialogHeader>
        <Select value={branchValue} onValueChange={setBranchValue}>
          <SelectTrigger>
            <SelectValue
              placeholder={t('agentFiles.selectBranch', { defaultValue: 'Select branch' })}
            />
          </SelectTrigger>
          <SelectContent>
            {branchOptions.map((branch) => (
              <SelectItem key={branch.fullName} value={branch.name}>
                {branchItemLabel(branch)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => setBranchDialog(null)}>
            {t('agentFiles.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            disabled={!branchValue || busyAction !== null}
            onClick={() => void handleBranchAction()}
          >
            {busyAction === branchDialog ? <Loader2 className="size-4 animate-spin" /> : null}
            {branchDialog === 'merge'
              ? t('agentFiles.merge', { defaultValue: 'Merge' })
              : t('agentFiles.checkout', { defaultValue: 'Checkout' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
