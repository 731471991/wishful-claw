import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { WindowControls } from '@renderer/components/layout/WindowControls'
import { useUIStore } from '@renderer/stores/ui-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { PersonaSelectPage } from './splash/PersonaSelectPage'

export function SplashPage(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const enterMain = useUIStore((s) => s.enterMain)
  const openSettings = useUIStore((s) => s.openSettings)
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted)

  // Auto-enter main if onboarding already completed
  useEffect(() => {
    if (onboardingCompleted) {
      enterMain()
    }
  }, [onboardingCompleted, enterMain])

  // Onboarding not completed — show persona selection
  if (!onboardingCompleted) {
    return <PersonaSelectPage />
  }

  // Brief loading state while transitioning to main
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex h-10 shrink-0 items-center justify-between border-b bg-background/90 backdrop-blur">
        <div className="flex items-center px-3">
          <div className="text-sm font-semibold text-foreground">Wishful Claw</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => openSettings('provider')}
          >
            <Settings className="size-3.5" />
            {t('splash.enterSettings', { defaultValue: 'AI 服务商设置' })}
          </Button>
          <WindowControls />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center">
        <div className="text-sm text-muted-foreground">
          {t('splash.loading', { defaultValue: '正在进入...' })}
        </div>
      </main>
    </div>
  )
}
