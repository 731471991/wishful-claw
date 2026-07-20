import { Toaster } from 'sonner'
import { ThemeProvider } from '@renderer/components/theme-provider'
import { ThemeRuntimeSync } from '@renderer/components/ThemeRuntimeSync'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { useUIStore } from '@renderer/stores/ui-store'
import { initProviderStore } from '@renderer/stores/provider-store'

// Initialize provider store — ensures builtin presets exist
initProviderStore()
import { SplashPage } from '@renderer/components/SplashPage'
import { MainLayout } from '@renderer/components/layout/MainLayout'
import { SettingsPage } from '@renderer/components/settings/SettingsPage'

function App(): React.JSX.Element {
  const view = useUIStore((s) => s.view)

  return (
    <ThemeProvider defaultTheme="dark">
      <ThemeRuntimeSync />
      <TooltipProvider delayDuration={0}>
        {view === 'splash' && <SplashPage />}
        {view === 'main' && <MainLayout />}
        {view === 'settings' && <SettingsPage />}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App
