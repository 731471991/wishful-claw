import type { ITheme } from './theme-presets/types'
import type {
  AppThemeMode,
  AppThemePreset,
  SshTerminalThemePreset,
  ThemeCssVars,
  ThemePreviewPalette,
  SshChromePalette,
  ThemePresetDefinition,
} from './theme-presets/types'
import { createTerminalTheme } from './theme-presets/terminal-theme'
import { mulberryPreset } from './theme-presets/mulberry'
import { studioPreset } from './theme-presets/studio'
import { graphitePreset } from './theme-presets/graphite'
import { oceanPreset } from './theme-presets/ocean'
import { forestPreset } from './theme-presets/forest'
import { dawnPreset } from './theme-presets/dawn'

export type { AppThemeMode, AppThemePreset, SshTerminalThemePreset, ThemePresetDefinition, SshChromePalette }

export const DEFAULT_APP_THEME_PRESET: AppThemePreset = 'ocean'
export const DEFAULT_SSH_TERMINAL_THEME_PRESET: SshTerminalThemePreset = DEFAULT_APP_THEME_PRESET

const PRESET_DEFINITIONS: Record<AppThemePreset, ThemePresetDefinition> = {
  mulberry: mulberryPreset,
  studio: studioPreset,
  graphite: graphitePreset,
  ocean: oceanPreset,
  forest: forestPreset,
  dawn: dawnPreset,
}

const APP_THEME_PRESET_IDS: AppThemePreset[] = [
  'mulberry',
  'studio',
  'graphite',
  'ocean',
  'forest',
  'dawn'
]

export const APP_THEME_PRESETS = APP_THEME_PRESET_IDS.map((id) => PRESET_DEFINITIONS[id])
const ALL_THEME_CSS_VAR_KEYS = Array.from(
  new Set(
    APP_THEME_PRESETS.flatMap((preset) =>
      Object.values(preset.cssVars).flatMap((vars) => Object.keys(vars))
    )
  )
)

export function isAppThemePreset(value: unknown): value is AppThemePreset {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRESET_DEFINITIONS, value)
  )
}

export function resolveAppThemeMode(value?: string | null): AppThemeMode {
  return value === 'light' ? 'light' : 'dark'
}

export function getThemePresetDefinition(preset: AppThemePreset): ThemePresetDefinition {
  return PRESET_DEFINITIONS[preset] ?? PRESET_DEFINITIONS[DEFAULT_APP_THEME_PRESET]
}

export function getTerminalTheme(preset: AppThemePreset, mode: AppThemeMode): ITheme {
  return getThemePresetDefinition(preset).terminal[mode]
}

export function getSshChromePalette(preset: AppThemePreset, mode: AppThemeMode): SshChromePalette {
  return getThemePresetDefinition(preset).ssh[mode]
}

export function applyThemePresetCssVars(
  root: HTMLElement,
  preset: AppThemePreset,
  mode: AppThemeMode
): void {
  const cssVars = getThemePresetDefinition(preset).cssVars[mode]
  for (const key of ALL_THEME_CSS_VAR_KEYS) {
    root.style.removeProperty(key)
  }
  for (const [key, value] of Object.entries(cssVars)) {
    root.style.setProperty(key, value)
  }
}
