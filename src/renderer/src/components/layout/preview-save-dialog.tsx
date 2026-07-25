// Save dialog for PreviewPanel

import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'

interface PreviewSaveDialogProps {
  open: boolean
  pendingFileDisplayName: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onDiscard: () => void
}

export function PreviewSaveDialog({
  open, pendingFileDisplayName, onOpenChange, onConfirm, onDiscard
}: PreviewSaveDialogProps): React.JSX.Element {
  const { t } = useTranslation('layout')
  return (
      <AlertDialog open={showSaveDialog} onOpenChange={handleSaveDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('preview.unsavedChanges')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('preview.unsavedChangesDesc', { fileName: pendingFileDisplayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(event) => {
                event.preventDefault()
                handleSaveDialogDiscard()
              }}
            >
              {t('preview.discard')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleSaveDialogConfirm()
              }}
            >
              {t('action.save', { ns: 'common' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  )
}
