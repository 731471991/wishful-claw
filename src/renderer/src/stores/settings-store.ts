import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppThemePreset } from '@renderer/lib/theme-presets'
import { DEFAULT_APP_THEME_PRESET } from '@renderer/lib/theme-presets'

export type ThemeMode = 'light' | 'dark' | 'system'

interface GeneralSettings {
  // Theme
  theme: ThemeMode
  themePreset: AppThemePreset

  // Appearance
  fontFamily: string
  fontSize: number
  backgroundColor: string
}

interface SettingsState extends GeneralSettings {
  updateSettings: (partial: Partial<GeneralSettings>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      themePreset: DEFAULT_APP_THEME_PRESET,
      fontFamily: '',
      fontSize: 14,
      backgroundColor: '',

      updateSettings: (partial) => set(partial)
    }),
    {
      name: 'wishful-claw-settings',
      partialize: (state) => ({
        theme: state.theme,
        themePreset: state.themePreset,
        fontFamily: state.fontFamily,
        fontSize: state.fontSize,
        backgroundColor: state.backgroundColor
      })
    }
  )
)
