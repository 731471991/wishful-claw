import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@renderer/components/theme-provider'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { useUIStore } from '@renderer/stores/ui-store'
import { SplashPage } from '@renderer/components/SplashPage'
import { MainLayout } from '@renderer/components/layout/MainLayout'
import { SettingsPage } from '@renderer/components/settings/SettingsPage'

function App(): React.JSX.Element {
  const view = useUIStore((s) => s.view)

  // Ensure dark theme is applied by default
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  return (
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider delayDuration={0}>
        {view === 'splash' && <SplashPage />}
        {view === 'main' && <MainLayout />}
        {view === 'settings' && <SettingsPage />}
        <Toaster position="bottom-right" theme="dark" />
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App
