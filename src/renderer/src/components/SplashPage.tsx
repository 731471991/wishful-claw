import { useTranslation } from 'react-i18next'
import { BrainCircuit, ArrowRight, Wrench, Users, Settings } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { WindowControls } from '@renderer/components/layout/WindowControls'
import { useUIStore } from '@renderer/stores/ui-store'

export function SplashPage(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const enterMain = useUIStore((s) => s.enterMain)
  const openSettings = useUIStore((s) => s.openSettings)

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Title bar */}
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
            {t('splash.enterSettings')}
          </Button>
          <WindowControls />
        </div>
      </header>

      {/* Main content */}
      <main className="flex min-h-0 flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-2xl space-y-8">
          {/* Brand mark */}
          <div className="flex size-14 items-center justify-center rounded-lg border bg-background shadow-sm">
            <BrainCircuit className="size-7 text-primary" />
          </div>

          {/* Title & subtitle */}
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold">Wishful Claw</h1>
            <p className="text-sm leading-6 text-muted-foreground">{t('splash.hero')}</p>
          </div>

          {/* Feature points */}
          <div className="space-y-5">
            <div className="grid grid-cols-[34px_1fr] gap-4">
              <div className="flex size-8 items-center justify-center rounded-md border bg-background">
                <Wrench className="size-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold">{t('splash.features.localFirst')}</h2>
                <p className="text-sm text-muted-foreground">{t('splash.features.localFirstDesc')}</p>
              </div>
            </div>

            <div className="grid grid-cols-[34px_1fr] gap-4">
              <div className="flex size-8 items-center justify-center rounded-md border bg-background">
                <Users className="size-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold">{t('splash.features.intelligent')}</h2>
                <p className="text-sm text-muted-foreground">{t('splash.features.intelligentDesc')}</p>
              </div>
            </div>
          </div>

          {/* Enter button */}
          <div className="pt-2">
            <Button className="h-11 min-w-36 px-6" onClick={enterMain}>
              <ArrowRight className="size-4" />
              {t('splash.enterMain')}
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex h-10 shrink-0 items-center justify-center border-t text-[11px] text-muted-foreground/50">
        Wishful Claw · v0.2.0-dev
      </footer>
    </div>
  )
}
