/**
 * Theme synchronizer for popup windows (clipboard, launcher).
 *
 * Reads the same settings as the main app's ThemeRuntimeSync component,
 * resolves the theme mode, and applies the CSS variables to <html>.
 */

import {
  applyThemePresetCssVars,
  DEFAULT_APP_THEME_PRESET,
  type AppThemeMode,
  type AppThemePreset
} from './theme-presets'

interface PersistedSettings {
  theme?: string
  themePreset?: string
  backgroundColor?: string
  fontFamily?: string
  fontSize?: number
}

/**
 * Read theme-related fields from the main process settings store.
 *
 * The IPC returns a Zustand persist object: { state: { ... }, version: N }
 * We need to extract fields from .state.
 */
async function readThemeSettings(): Promise<PersistedSettings> {
  try {
    const raw = await window.api.invoke<unknown>('settings:get', 'wishfulclaw-settings')
    if (!raw) return {}

    // Zustand persist format: { state: { ... }, version: N }
    let state: Record<string, unknown> | null = null
    if (typeof raw === 'object' && raw !== null) {
      const obj = raw as Record<string, unknown>
      if (obj.state && typeof obj.state === 'object') {
        state = obj.state as Record<string, unknown>
      } else {
        // Maybe the caller returned state directly
        state = obj
      }
    }

    if (!state) return {}

    return {
      theme: typeof state.theme === 'string' ? state.theme : undefined,
      themePreset: typeof state.themePreset === 'string' ? state.themePreset : undefined,
      backgroundColor: typeof state.backgroundColor === 'string' ? state.backgroundColor : undefined,
      fontFamily: typeof state.fontFamily === 'string' ? state.fontFamily : undefined,
      fontSize: typeof state.fontSize === 'number' ? state.fontSize : undefined
    }
  } catch {
    // ignore — fall through to defaults
  }
  return {}
}

/** Resolve 'light' | 'dark' | 'system' to a concrete AppThemeMode. */
function resolveMode(theme: string | undefined): AppThemeMode {
  const raw = theme ?? 'system'
  if (raw === 'light') return 'light'
  if (raw === 'dark') return 'dark'
  // system
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function isAppThemePreset(value: unknown): value is AppThemePreset {
  const valid: string[] = ['mulberry', 'studio', 'graphite', 'ocean', 'forest', 'dawn']
  return typeof value === 'string' && valid.includes(value)
}

/**
 * Fetch theme settings from the main process and apply them to the document root.
 * Call this before rendering the popup React app to avoid a flash of wrong theme.
 */
export async function syncThemeFromSettings(): Promise<void> {
  const settings = await readThemeSettings()

  const mode = resolveMode(settings.theme)
  const preset: AppThemePreset = isAppThemePreset(settings.themePreset)
    ? settings.themePreset
    : DEFAULT_APP_THEME_PRESET

  const root = document.documentElement

  // Apply dark/light class (same as next-themes attribute="class")
  root.classList.remove('light', 'dark')
  root.classList.add(mode)

  // Apply theme preset CSS variables
  applyThemePresetCssVars(root, preset, mode)
  root.dataset.themePreset = preset

  // Apply appearance overrides
  if (settings.backgroundColor && settings.backgroundColor.trim()) {
    root.style.setProperty('--app-background', settings.backgroundColor.trim())
  }
  if (settings.fontFamily && settings.fontFamily.trim()) {
    root.style.setProperty('--app-font-family', settings.fontFamily.trim())
  }
  if (typeof settings.fontSize === 'number' && Number.isFinite(settings.fontSize)) {
    root.style.setProperty('--app-font-size', `${settings.fontSize}px`)
  }
}
