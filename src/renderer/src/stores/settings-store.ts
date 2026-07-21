import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AppThemePreset } from '@renderer/lib/theme-presets'
import { DEFAULT_APP_THEME_PRESET } from '@renderer/lib/theme-presets'
import type { AppLanguage } from '@renderer/lib/i18n-language'
import { detectSystemLanguage } from '@renderer/lib/i18n-language'
import { settingsStorage } from '@renderer/lib/ipc/settings-storage'

export type ThemeMode = 'light' | 'dark' | 'system'

interface GeneralSettings {
  // Language
  language: AppLanguage

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
      language: detectSystemLanguage(),
      theme: 'dark',
      themePreset: DEFAULT_APP_THEME_PRESET,
      fontFamily: '',
      fontSize: 14,
      backgroundColor: '',

      updateSettings: (partial) => set(partial)
    }),
    {
      name: 'wishful-claw-settings',
      storage: createJSONStorage(() => settingsStorage),
      partialize: (state) => ({
        language: state.language,
        theme: state.theme,
        themePreset: state.themePreset,
        fontFamily: state.fontFamily,
        fontSize: state.fontSize,
        backgroundColor: state.backgroundColor
      })
    }
  )
)
