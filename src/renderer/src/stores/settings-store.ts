import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AppThemePreset } from '@renderer/lib/theme-presets'
import type { ReasoningEffortLevel, ThinkingConfig } from '@shared/types/provider'
import { DEFAULT_APP_THEME_PRESET } from '@renderer/lib/theme-presets'
import type { AppLanguage } from '@renderer/lib/i18n-language'
import { detectSystemLanguage } from '@renderer/lib/i18n-language'
import { settingsStorage } from '@renderer/lib/ipc/settings-storage'
import { useProviderStore } from '@renderer/stores/provider-store'

export type ThemeMode = 'light' | 'dark' | 'system'
export type MainModelSelectionMode = 'auto' | 'manual'

export function getReasoningEffortKey(
  providerId?: string | null,
  modelId?: string | null
): string | null {
  if (!providerId || !modelId) return null
  return `${providerId}:${modelId}`
}

export function resolveReasoningEffortForModel({
  reasoningEffort,
  reasoningEffortByModel,
  providerId,
  modelId,
  thinkingConfig
}: {
  reasoningEffort: ReasoningEffortLevel
  reasoningEffortByModel?: Record<string, ReasoningEffortLevel>
  providerId?: string | null
  modelId?: string | null
  thinkingConfig?: ThinkingConfig
}): ReasoningEffortLevel {
  const key = getReasoningEffortKey(providerId, modelId)
  const levels = thinkingConfig?.reasoningEffortLevels
  const savedEffort = key ? reasoningEffortByModel?.[key] : undefined

  if (savedEffort && (!levels || levels.includes(savedEffort))) {
    return savedEffort
  }

  return thinkingConfig?.defaultReasoningEffort ?? reasoningEffort
}

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

  // Model settings (from OpenCowork)
  thinkingEnabled: boolean
  fastModeEnabled: boolean
  reasoningEffort: ReasoningEffortLevel
  reasoningEffortByModel: Record<string, ReasoningEffortLevel>
  mainModelSelectionMode: MainModelSelectionMode
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

      // Model settings defaults
      thinkingEnabled: false,
      fastModeEnabled: false,
      reasoningEffort: 'medium',
      reasoningEffortByModel: {},
      mainModelSelectionMode: 'auto',

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
        backgroundColor: state.backgroundColor,
        thinkingEnabled: state.thinkingEnabled,
        fastModeEnabled: state.fastModeEnabled,
        reasoningEffort: state.reasoningEffort,
        reasoningEffortByModel: state.reasoningEffortByModel,
        mainModelSelectionMode: state.mainModelSelectionMode
      }),
      onRehydrateStorage: () => (state) => {
        // If manual mode but no model was explicitly selected, fall back to auto
        if (state?.mainModelSelectionMode === 'manual') {
          if (!useProviderStore.getState().activeModelId) {
            useSettingsStore.setState({ mainModelSelectionMode: 'auto' })
          }
        }
      }
    }
  )
)
