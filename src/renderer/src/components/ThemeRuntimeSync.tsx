import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { applyThemePresetCssVars, resolveAppThemeMode } from '@renderer/lib/theme-presets'
import { useSettingsStore } from '@renderer/stores/settings-store'

export function ThemeRuntimeSync(): null {
  const theme = useSettingsStore((s) => s.theme)
  const themePreset = useSettingsStore((s) => s.themePreset)
  const backgroundColor = useSettingsStore((s) => s.backgroundColor)
  const fontFamily = useSettingsStore((s) => s.fontFamily)
  const fontSize = useSettingsStore((s) => s.fontSize)
  const { theme: activeTheme, resolvedTheme, setTheme } = useTheme()

  // Sync theme mode to next-themes
  useEffect(() => {
    if (theme !== activeTheme) {
      setTheme(theme)
    }
  }, [activeTheme, setTheme, theme])

  // Apply theme preset CSS vars + appearance settings
  useEffect(() => {
    const root = document.documentElement

    applyThemePresetCssVars(root, themePreset, resolveAppThemeMode(resolvedTheme))
    root.dataset.themePreset = themePreset

    if (backgroundColor && backgroundColor.trim()) {
      root.style.setProperty('--app-background', backgroundColor.trim())
    } else {
      root.style.removeProperty('--app-background')
    }

    if (fontFamily && fontFamily.trim()) {
      root.style.setProperty('--app-font-family', fontFamily.trim())
    } else {
      root.style.removeProperty('--app-font-family')
    }

    if (typeof fontSize === 'number' && Number.isFinite(fontSize)) {
      root.style.setProperty('--app-font-size', `${fontSize}px`)
    } else {
      root.style.removeProperty('--app-font-size')
    }
  }, [backgroundColor, fontFamily, fontSize, resolvedTheme, themePreset])

  return null
}
