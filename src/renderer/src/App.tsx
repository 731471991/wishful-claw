import { useState, useEffect } from 'react'
import { Toaster } from '@renderer/components/ui/sonner'
import { ThemeProvider } from '@renderer/components/theme-provider'
import { ThemeRuntimeSync } from '@renderer/components/ThemeRuntimeSync'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import { useUIStore } from '@renderer/stores/ui-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { initProviderStore } from '@renderer/stores/provider-store'
import { initializeI18n, changeI18nLanguage } from '@renderer/locales'
import { SplashPage } from '@renderer/components/SplashPage'
import { MainLayout } from '@renderer/components/layout/MainLayout'
import { SettingsPage } from '@renderer/components/settings/SettingsPage'
import { attachRendererToolBridge } from '@renderer/lib/ipc/renderer-tool-bridge'
import { registerAllTools } from '@renderer/lib/tools'
import { useMcpStore } from '@renderer/stores/mcp-store'
import { registerBrowserTool } from '@renderer/lib/tools/browser-tool'
import { registerAllViewers } from '@renderer/lib/preview/register-viewers'

// Initialize provider store — ensures builtin presets exist
initProviderStore()

function App(): React.JSX.Element | null {
  const view = useUIStore((s) => s.view)
  const language = useSettingsStore((s) => s.language)
  const [i18nReady, setI18nReady] = useState(false)
  const [i18nError, setI18nError] = useState<Error | null>(null)

  // Initialize i18n on mount
  useEffect(() => {
    initializeI18n()
      .then(() => setI18nReady(true))
      .catch((err) => {
        console.error('i18n init failed:', err)
        setI18nError(err)
      })

    // Register frontend tool handlers (browser tools, etc.)
    attachRendererToolBridge()
    registerBrowserTool()

    // Register preview viewers (image, markdown, code, etc.)
    registerAllViewers()

    // Register all tools (fs, search, bash, memory, etc.) for the frontend tool registry
    registerAllTools().catch((err) => {
      console.warn('registerAllTools failed (some tools may not be available):', err)
    })
    // Initialize MCP servers at startup so they're ready before first message
    useMcpStore.getState().ensureConversationReady(null).catch((err) => {
      console.warn('MCP initialization failed:', err)
    })
  }, [])

  // Sync language changes
  useEffect(() => {
    if (i18nReady) {
      changeI18nLanguage(language)
    }
  }, [language, i18nReady])

  if (i18nError) {
    return (
      <div style={{ padding: 32, fontFamily: 'monospace', fontSize: 14, color: '#f00', whiteSpace: 'pre-wrap' }}>
        <h2>i18n Initialization Error</h2>
        <div>{i18nError.message}</div>
        <div style={{ marginTop: 16, color: '#666' }}>{i18nError.stack}</div>
      </div>
    )
  }

  if (!i18nReady) {
    return null
  }

  return (
    <ThemeProvider defaultTheme="system">
      <ThemeRuntimeSync />
      <ErrorBoundary>
        <TooltipProvider delayDuration={0}>
          {view === 'splash' && <SplashPage />}
          {view === 'main' && <MainLayout />}
          {view === 'settings' && <SettingsPage />}
          <Toaster position="bottom-left" theme="system" richColors />
        </TooltipProvider>
      </ErrorBoundary>
    </ThemeProvider>
  )
}

export default App
