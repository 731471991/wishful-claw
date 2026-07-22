export const BUILTIN_BROWSER_PARTITION = 'persist:opencowork-browser'
export const BROWSER_SETTINGS_STORAGE_KEY = 'opencowork-settings'
export const BROWSER_USER_DATA_REUSE_SETTING_KEY = 'browserUserDataReuseEnabled'
export const BROWSER_USER_DATA_SOURCE_SETTING_KEY = 'browserUserDataSource'

export const BROWSER_USER_DATA_SOURCES = ['auto', 'chrome', 'edge', 'brave', 'chromium'] as const
export type BrowserUserDataSource = (typeof BROWSER_USER_DATA_SOURCES)[number]
export type ConcreteBrowserUserDataSource = Exclude<BrowserUserDataSource, 'auto'>
export const DEFAULT_BROWSER_USER_DATA_SOURCE: BrowserUserDataSource = 'auto'

export function isBrowserUserDataReuseEnabled(value: unknown): boolean {
  return value !== false
}

export function normalizeBrowserUserDataSource(value: unknown): BrowserUserDataSource {
  return BROWSER_USER_DATA_SOURCES.includes(value as BrowserUserDataSource)
    ? (value as BrowserUserDataSource)
    : DEFAULT_BROWSER_USER_DATA_SOURCE
}

export function stripElectronFromUserAgent(userAgent: string): string {
  return userAgent.replace(/\sElectron\/[^\s]+/g, '').trim()
}
