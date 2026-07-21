import { create } from 'zustand'

export type AppView = 'splash' | 'main' | 'chat' | 'settings'

export type SettingsTab = 'provider' | 'modelManagement' | 'general' | 'about'

interface UIState {
  // Top-level view
  view: AppView
  setView: (view: AppView) => void

  // Settings
  settingsTab: SettingsTab
  setSettingsTab: (tab: SettingsTab) => void

  // Navigation helpers
  enterMain: () => void
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void

  enterChat: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  view: 'splash',
  setView: (view) => set({ view }),

  settingsTab: 'provider',
  setSettingsTab: (settingsTab) => set({ settingsTab }),

  enterMain: () => set({ view: 'main' }),

  openSettings: (tab) =>
    set({ view: 'settings', settingsTab: tab ?? 'provider' }),

  closeSettings: () => set({ view: 'main' }),

  enterChat: () => set({ view: 'chat' })
}))
