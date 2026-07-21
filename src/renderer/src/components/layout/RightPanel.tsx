import { useTranslation } from 'react-i18next'
import { PanelRightClose } from 'lucide-react'
import { useUIStore } from '@renderer/stores/ui-store'
import { ActivityPanel } from '@renderer/components/activity/ActivityPanel'

/**
 * Right Panel — placeholder shell.
 * TODO (迭代四): Full implementation with tabs (review/files/preview/browser/subagent/terminal).
 */
export function RightPanel(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen)

  return (
    <div className="flex h-full w-full flex-col border-l bg-card/50">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t('sectionExecution.title', { defaultValue: 'Execution' })}
        </span>
        <button
          onClick={() => setRightPanelOpen(false)}
          className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {/* Use the existing ActivityPanel for now */}
        <ActivityPanel />
      </div>
    </div>
  )
}

export function RightPanelHeader(): React.JSX.Element | null {
  return null
}
