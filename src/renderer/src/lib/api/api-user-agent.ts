import { APP_VERSION } from '../app-version'

const APP_NAME = 'WishfulClaw'
const DEFAULT_API_USER_AGENT = APP_VERSION ? `${APP_NAME}/${APP_VERSION}` : APP_NAME

function isDefaultApiUserAgentPlaceholder(userAgent: string): boolean {
  return userAgent === APP_NAME || userAgent === `${APP_NAME}/`
}

export function getDefaultApiUserAgent(): string {
  return DEFAULT_API_USER_AGENT
}

export function resolveProviderUserAgent(userAgent?: string): string {
  const trimmed = userAgent?.trim()
  return trimmed && !isDefaultApiUserAgentPlaceholder(trimmed) ? trimmed : getDefaultApiUserAgent()
}
