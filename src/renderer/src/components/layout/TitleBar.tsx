import { useTranslation } from 'react-i18next'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useUIStore } from '@renderer/stores/ui-store'
import { WindowControls } from './WindowControls'

interface TitleBarProps {
  title: string
  subtitle?: string | null
  tooltip?: string | null
  showSidebarToggle?: boolean
}

export function TitleBar({
  title,
  tooltip = null,
  showSidebarToggle = true
}: TitleBarProps): React.JSX.Element {
  const { t } = useTranslation('layout')
  const leftSidebarOpen = useUIStore((s) => s.leftSidebarOpen)
  const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar)
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen)
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel)

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b bg-background/90 backdrop-blur">
      <div className="flex items-center gap-1 px-2">
        {showSidebarToggle && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleLeftSidebar}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {leftSidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('topbar.toggleSidebar', { defaultValue: 'Toggle sidebar' })}</TooltipContent>
          </Tooltip>
        )}

        <div className="truncate px-2 text-sm font-semibold text-foreground/92" title={tooltip ?? title}>
          {title}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleRightPanel}
              className={`flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground ${
                rightPanelOpen ? 'text-foreground bg-accent' : 'text-muted-foreground'
              }`}
            >
              {rightPanelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('topbar.toggleRightPanel', { defaultValue: 'Toggle right panel' })}</TooltipContent>
        </Tooltip>

        <WindowControls />
      </div>
    </header>
  )
}
