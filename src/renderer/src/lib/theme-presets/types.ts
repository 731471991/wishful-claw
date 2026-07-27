// ITheme type stub for xterm
interface ITheme { [key: string]: unknown }

export type AppThemeMode = 'light' | 'dark'
export type AppThemePreset = 'mulberry' | 'studio' | 'graphite' | 'ocean' | 'forest' | 'dawn'
export type SshTerminalThemePreset = AppThemePreset

type ThemeCssVars = Record<`--${string}`, string>

type ThemePreviewPalette = {
  rail: string
  canvas: string
  card: string
  accent: string
  accentSoft: string
  text: string
}

export type SshChromePalette = {
  libraryFrameStart: string
  libraryFrameEnd: string
  libraryBorder: string
  libraryText: string
  connectFrame: string
  connectBorder: string
  connectText: string
  terminalFrame: string
  terminalBorder: string
  terminalText: string
  canvas: string
  canvasSubtle: string
  terminalCanvas: string
  panel: string
  panelStrong: string
  panelBorder: string
  surface: string
  surfaceStrong: string
  text: string
  muted: string
  accent: string
  accentSoft: string
  accentContrast: string
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
  badge: string
  libraryPill: string
  libraryPillActive: string
  libraryPillText: string
  libraryPillActiveText: string
  connectPill: string
  connectPillActive: string
  connectPillText: string
  connectPillActiveText: string
  terminalPill: string
  terminalPillActive: string
  terminalPillText: string
  terminalPillActiveText: string
}

export type ThemePresetDefinition = {
  id: AppThemePreset
  labelKey: string
  descriptionKey: string
  swatches: [string, string, string]
  preview: Record<AppThemeMode, ThemePreviewPalette>
  cssVars: Record<AppThemeMode, ThemeCssVars>
  terminal: Record<AppThemeMode, ITheme>
  ssh: Record<AppThemeMode, SshChromePalette>
}

export const DEFAULT_APP_THEME_PRESET: AppThemePreset = 'ocean'
export const DEFAULT_SSH_TERMINAL_THEME_PRESET: SshTerminalThemePreset = DEFAULT_APP_THEME_PRESET