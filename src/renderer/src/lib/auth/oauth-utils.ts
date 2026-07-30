import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import type { OAuthConfig } from '@renderer/lib/api/types'

export interface OAuthCallbackPayload {
  requestId: string
  code?: string | null
  state?: string | null
  error?: string | null
  errorDescription?: string | null
}

export interface OAuthDeviceCodeInfo {
  deviceCode: string
  userCode: string
  verificationUri: string
  verificationUriComplete?: string
  expiresAt?: number
  intervalSeconds?: number
  deviceId?: string
}

export interface StartOAuthFlowOptions {
  signal?: AbortSignal
  onDeviceCode?: (info: OAuthDeviceCodeInfo) => void
}

export const KIMI_CLIENT_ID = '17e5f671-d194-4dfb-9706-5516cb48c098'
export const KIMI_CLIENT_VERSION = '1.30.0'

interface AppSystemInfoPayload {
  machineName?: string
  platform?: string
  arch?: string
  release?: string
}

let appSystemInfoPromise: Promise<AppSystemInfoPayload> | null = null

function base64UrlEncode(bytes: Uint8Array): string {
  let str = ''
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i])
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function randomString(length = 64): string {
  const bytes = new Uint8Array(length)
  window.crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

export function randomHex(bytes = 16): string {
  const buffer = new Uint8Array(bytes)
  window.crypto.getRandomValues(buffer)
  return Array.from(buffer, (value) => value.toString(16).padStart(2, '0')).join('')
}

export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await window.crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(hash))
}

function toAsciiHeaderValue(value: string | undefined | null, fallback = 'unknown'): string {
  if (!value) return fallback
  const ascii = Array.from(value)
    .filter((char) => char.charCodeAt(0) <= 0x7f)
    .join('')
    .trim()
  return ascii || fallback
}

function normalizeMoonshotArch(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return 'Unknown'
  if (normalized === 'x64') return 'X64'
  if (normalized === 'arm64') return 'Arm64'
  if (normalized === 'x86' || normalized === 'ia32') return 'X86'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function buildMoonshotDeviceModel(info: AppSystemInfoPayload): string {
  const platform = info.platform?.trim().toLowerCase()
  const arch = normalizeMoonshotArch(info.arch)
  const release = info.release?.trim()

  if (platform === 'win32') {
    const build = Number(release?.split('.').pop() ?? '')
    const version = Number.isFinite(build) && build >= 22000 ? '11' : '10'
    return `Windows ${version} ${arch}`
  }

  if (platform === 'darwin') {
    return `macOS ${release || 'unknown'} ${arch}`
  }

  const description = [platform, release].filter(Boolean).join(' ').trim() || 'Unknown'
  return `${description} ${arch}`.trim()
}

async function getAppSystemInfo(): Promise<AppSystemInfoPayload> {
  if (!appSystemInfoPromise) {
    appSystemInfoPromise = (async () => {
      try {
        const result = (await ipcClient.invoke('app:system-info')) as AppSystemInfoPayload | null
        if (result && typeof result === 'object') {
          return result
        }
      } catch {
        // Ignore IPC failures and fall back to renderer-visible values.
      }

      const platform = /mac/i.test(navigator.platform)
        ? 'darwin'
        : /win/i.test(navigator.platform)
          ? 'win32'
          : navigator.platform.toLowerCase() || undefined

      return { platform }
    })()
  }

  return appSystemInfoPromise
}

export function isMoonshotOAuthConfig(
  config: Pick<OAuthConfig, 'clientId' | 'tokenUrl' | 'deviceCodeUrl'>
): boolean {
  const endpoints = `${config.tokenUrl || ''} ${config.deviceCodeUrl || ''}`
  return config.clientId === KIMI_CLIENT_ID || /auth\.kimi\.com/i.test(endpoints)
}

export function isMoonshotProviderConfig(config: {
  providerBuiltinId?: string
  baseUrl?: string
}): boolean {
  if (config.providerBuiltinId === 'moonshot-coding') return true
  return /https?:\/\/api\.kimi\.com\/coding/i.test((config.baseUrl ?? '').trim())
}

export async function buildMoonshotCommonHeaders(
  deviceId?: string
): Promise<Record<string, string>> {
  const systemInfo = await getAppSystemInfo()

  return {
    'X-Msh-Platform': 'kimi_cli',
    'X-Msh-Version': KIMI_CLIENT_VERSION,
    'X-Msh-Device-Name': toAsciiHeaderValue(systemInfo.machineName),
    'X-Msh-Device-Model': toAsciiHeaderValue(buildMoonshotDeviceModel(systemInfo)),
    'X-Msh-Os-Version': toAsciiHeaderValue(systemInfo.release),
    'X-Msh-Device-Id': deviceId?.trim() || randomHex(16)
  }
}

