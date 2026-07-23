import { useState as useReactState } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelRightClose, Activity, Brain } from 'lucide-react'
import { useUIStore } from '@renderer/stores/ui-store'
import { ActivityPanel } from '@renderer/components/activity/ActivityPanel'
import { MemoryPanel } from '@renderer/components/memory/MemoryPanel'
import { useChatStore } from '@renderer/stores/chat-store'

type PanelTab = 'activity' | 'memory'

const activeTab = 'activity' as PanelTab
const currentTab = activeTab

/**
 * Right Panel — Activity + Memory tabs.
 */
export function RightPanel(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const setRightPanelOpen = useUIStore((s) => s.setRightPanelOpen)
  const [tab, setTab] = useReactState<PanelTab>(currentTab)
  const workingFolder = useChatStore((s) => {
    const project = s.projects.find((p) => p.id === s.activeProjectId)
    return project?.workingFolder ?? null
  })

  return (
    <div className="flex h-full w-full flex-col border-l bg-card/50">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTab('activity')}
            className={`flex items-center gap-1 text-xs font-medium transition-colors ${
              tab === 'activity' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            {t('sectionExecution.title', { defaultValue: 'Activity' })}
          </button>
          <button
            onClick={() => setTab('memory')}
            className={`flex items-center gap-1 text-xs font-medium transition-colors ${
              tab === 'memory' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Brain className="h-3.5 w-3.5" />
            {t('memory.tabMemory', { defaultValue: 'Memory' })}
          </button>
        </div>
        <button
          onClick={() => setRightPanelOpen(false)}
          className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'activity' && <ActivityPanel />}
        {tab === 'memory' && <MemoryPanel workingFolder={workingFolder} />}
      </div>
    </div>
  )
}

export function RightPanelHeader(): React.JSX.Element | null {
  return null
}
