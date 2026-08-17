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

/** Read theme-related fields from the main process settings store. */
async function readThemeSettings(): Promise<PersistedSettings> {
  try {
    const raw = await window.api.invoke<unknown>('settings:get', 'wishfulclaw-settings')
    if (typeof raw === 'string') {
      return JSON.parse(raw) as PersistedSettings
    }
    if (raw && typeof raw === 'object') {
      return raw as PersistedSettings
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

/**
 * Inline script version (no async) — applies a best-guess theme synchronously
 * from next-themes localStorage key to prevent FOUC.
 * The full async syncThemeFromSettings() should still be called after mount.
 */
export function applyThemeInline(): void {
  try {
    const stored = localStorage.getItem('theme')
    let mode: AppThemeMode = 'dark'
    if (stored === 'light') {
      mode = 'light'
    } else if (stored === 'dark') {
      mode = 'dark'
    } else {
      // system or null
      mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(mode)

    // Apply default preset CSS vars as a baseline; async sync will override
    applyThemePresetCssVars(root, DEFAULT_APP_THEME_PRESET, mode)
    root.dataset.themePreset = DEFAULT_APP_THEME_PRESET
  } catch {
    // last resort: assume dark
    document.documentElement.classList.add('dark')
  }
}
