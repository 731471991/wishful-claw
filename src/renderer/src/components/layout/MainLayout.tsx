import { useTranslation } from 'react-i18next'
import { MessageSquare, Settings } from 'lucide-react'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { WindowControls } from '@renderer/components/layout/WindowControls'
import { useUIStore } from '@renderer/stores/ui-store'

function NavRail(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const openSettings = useUIStore((s) => s.openSettings)

  return (
    <div className="flex h-full w-12 shrink-0 flex-col items-center border-r bg-sidebar py-2">
      {/* Top nav items (placeholder for future features) */}
      <div className="flex flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-foreground"
            >
              <MessageSquare className="size-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{t('main.chat')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom: Settings + Version */}
      <div className="flex flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => openSettings('provider')}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-foreground"
            >
              <Settings className="size-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{t('main.settings')}</TooltipContent>
        </Tooltip>
        <span className="text-[9px] text-muted-foreground/40 select-none">v0.2.0</span>
      </div>
    </div>
  )
}

function MainContent(): React.JSX.Element {
  const { t } = useTranslation('layout')

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Title bar */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b bg-background/90 backdrop-blur">
        <div className="px-4 text-sm font-semibold text-foreground/92">Wishful Claw</div>
        <WindowControls />
      </header>

      {/* Main area — placeholder for future chat / agent loop */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{t('main.placeholder')}</p>
          <p className="mt-2 text-xs text-muted-foreground/60">{t('main.settingsHint')}</p>
        </div>
      </div>
    </div>
  )
}

export function MainLayout(): React.JSX.Element {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden bg-background">
        <NavRail />
        <MainContent />
      </div>
    </TooltipProvider>
  )
}
