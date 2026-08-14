import packageJson from '../../../../package.json'

/**
 * Single source of truth for the app version displayed in the UI.
 * Read from package.json so it never goes stale.
 */
export const APP_VERSION: string =
  typeof packageJson.version === 'string' ? packageJson.version.trim() : ''

/** Formatted version string for display, e.g. "v0.2.12". */
export const APP_VERSION_LABEL: string = APP_VERSION ? `v${APP_VERSION}` : ''
