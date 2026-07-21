export const DEFAULT_SETTINGS_TAB = 'provider'

export type SettingsTab = 'provider' | 'modelManagement' | 'general' | 'about'

export function parseSettingsRoute(): { tab: SettingsTab } {
  return { tab: DEFAULT_SETTINGS_TAB }
}

export function replaceSettingsRoute(_tab: SettingsTab): void {
  // Placeholder: no URL routing for now.
}
