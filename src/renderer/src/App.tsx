import { useState, useEffect } from 'react'
import { Toaster } from '@renderer/components/ui/sonner'
import { ThemeProvider } from '@renderer/components/theme-provider'
import { ThemeRuntimeSync } from '@renderer/components/ThemeRuntimeSync'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { useUIStore } from '@renderer/stores/ui-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { initProviderStore } from '@renderer/stores/provider-store'
import { initializeI18n, changeI18nLanguage } from '@renderer/locales'
import { SplashPage } from '@renderer/components/SplashPage'
import { MainLayout } from '@renderer/components/layout/MainLayout'
import { SettingsPage } from '@renderer/components/settings/SettingsPage'
import { ChatPage } from '@renderer/components/chat/ChatPage'

// Initialize provider store — ensures builtin presets exist
initProviderStore()

function App(): React.JSX.Element | null {
  const view = useUIStore((s) => s.view)
  const language = useSettingsStore((s) => s.language)
  const [i18nReady, setI18nReady] = useState(false)

  // Initialize i18n on mount
  useEffect(() => {
    initializeI18n().then(() => setI18nReady(true))
  }, [])

  // Sync language changes
  useEffect(() => {
    if (i18nReady) {
      changeI18nLanguage(language)
    }
  }, [language, i18nReady])

  if (!i18nReady) {
    return null
  }

  return (
    <ThemeProvider defaultTheme="dark">
      <ThemeRuntimeSync />
      <TooltipProvider delayDuration={0}>
        {view === 'splash' && <SplashPage />}
        {view === 'main' && <MainLayout />}
        {view === 'chat' && (
          <div className="h-screen w-screen">
            <ChatPage />
          </div>
        )}
        {view === 'settings' && <SettingsPage />}
        <Toaster position="bottom-left" theme="system" richColors />
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App
