import { nanoid } from 'nanoid'
import { useProviderStore } from '@renderer/stores/provider-store'
import type {
  AccountRateLimit,
  AIProvider,
  OAuthConfig,
  OAuthToken,
  ProviderOAuthAccount
} from '@renderer/lib/api/types'
import { startOAuthFlow, refreshOAuthFlow, type StartOAuthFlowOptions } from './oauth'
import {
  clearCopilotQuota,
  exchangeCopilotToken,
  isCopilotProvider,
  resolveCopilotApiKey,
  syncCopilotQuota
} from './copilot'
import { sendChannelCode, verifyChannelCode, fetchChannelUserInfo } from './channel'
import { findAccountById, getAccountsArray, getProviderById, pickUsableAccount, resolveOAuthConfig, setProviderAuth } from './provider-auth-utils'

const REFRESH_SKEW_MS = 2 * 60 * 1000

// Extracted from provider-auth.ts
export interface ImportOAuthAccountsResult {
  imported: ProviderOAuthAccount[]
  skipped: { index: number; reason: string }[]
}

/**
 * Batch import OAuth accounts from a JSON array. Each record MUST contain an `email` field.
 * Records without email are skipped with reason 'missing_email'. Records that fail parse
 * are skipped with reason 'invalid_record' or 'invalid_token'. Copilot token exchange is
 * performed for Copilot providers but its failure only skips the offending record.
 */
export async function importOauthAccountsFromJson(
  providerId: string,
  rawJson: string
): Promise<ImportOAuthAccountsResult> {
  const provider = getProviderById(providerId)
  if (!provider) throw new Error('Provider not found')

  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    throw new Error('invalid_json')
  }
  if (!Array.isArray(parsed)) throw new Error('expected_array')

  const imported: ProviderOAuthAccount[] = []
  const skipped: { index: number; reason: string }[] = []

  // Pull the latest provider snapshot once; we'll append incrementally then write at the end.
  let working = getAccountsArray(getProviderById(providerId) ?? provider)

  for (let i = 0; i < parsed.length; i += 1) {
    try {
      const { email, token, label } = parseImportRecord(parsed[i])
      // eslint-disable-next-line no-await-in-loop
      const finalToken = await finalizeOAuthToken(provider, token)
      const account: ProviderOAuthAccount = {
        id: nanoid(),
        email,
        oauth: finalToken,
        createdAt: Date.now(),
        ...(label ? { label } : {})
      }
      working = [...working, account]
      imported.push(account)
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'invalid_record'
      skipped.push({ index: i, reason })
    }
  }

  if (imported.length > 0) {
    const latest = getProviderById(providerId) ?? provider
    const activeId =
      latest.activeAccountId && working.some((a) => a.id === latest.activeAccountId)
        ? latest.activeAccountId
        : working[0].id
    setProviderAuth(providerId, buildAccountProjectionPatch(latest, working, activeId))
  }

  return { imported, skipped }
}

/** Serialize all accounts for export. Emits the same schema importOauthAccountsFromJson accepts. */
export function exportProviderAccounts(providerId: string): string {
  const provider = getProviderById(providerId)
  if (!provider) return '[]'
  const records = getAccountsArray(provider).map((a) => {
    const t = a.oauth
    return {
      email: a.email,
      ...(a.label ? { label: a.label } : {}),
      access_token: t.accessToken,
      ...(t.refreshToken ? { refresh_token: t.refreshToken } : {}),
      ...(t.expiresAt ? { expires_at: t.expiresAt } : {}),
      ...(t.scope ? { scope: t.scope } : {}),
      ...(t.tokenType ? { token_type: t.tokenType } : {}),
      ...(t.accountId ? { account_id: t.accountId } : {}),
      ...(t.idToken ? { id_token: t.idToken } : {}),
      ...(t.deviceId ? { device_id: t.deviceId } : {}),
      ...(t.copilotAccessToken ? { copilot_access_token: t.copilotAccessToken } : {}),
      ...(t.copilotExpiresAt ? { copilot_expires_at: t.copilotExpiresAt } : {}),
      ...(t.copilotApiUrl ? { copilot_api_url: t.copilotApiUrl } : {})
    }
  })
  return JSON.stringify(records, null, 2)
}

/** Refresh the OAuth token on a specific account (or the active one if accountId is omitted). */
export async function refreshProviderOAuth(
  providerId: string,
  force = false,
  accountId?: string
): Promise<boolean> {
  const provider = getProviderById(providerId)
  if (!provider || provider.authMode !== 'oauth') return false
  const config = resolveOAuthConfig(provider)
  if (!config || !config.tokenUrl || !config.clientId) return false

  const targetId = accountId ?? provider.activeAccountId
  const target = targetId ? findAccountById(provider, targetId) : undefined

  // Multi-account path
  if (target) {
    const current = target.oauth
    if (!current?.refreshToken) return false
    const expiresAt = current.expiresAt ?? 0
    if (!force && expiresAt && expiresAt - Date.now() > REFRESH_SKEW_MS) return true
    const next = await refreshOAuthFlow(config, current.refreshToken, current.deviceId)
    const mergedToken: OAuthToken = {
      ...current,
      ...next,
      refreshToken: next.refreshToken ?? current.refreshToken
    }
    const finalToken = await finalizeOAuthToken(provider, mergedToken)
    const updated: ProviderOAuthAccount = { ...target, oauth: finalToken }
    const accounts = upsertAccountInList(getAccountsArray(provider), updated)
    setProviderAuth(
      providerId,
      buildAccountProjectionPatch(provider, accounts, provider.activeAccountId ?? updated.id)
    )
    return true
  }

  // Legacy single-token fallback (no accounts array).
  const current = provider.oauth
  if (!current?.refreshToken) return false
  const expiresAt = current.expiresAt ?? 0
  if (!force && expiresAt && expiresAt - Date.now() > REFRESH_SKEW_MS) return true
  const next = await refreshOAuthFlow(config, current.refreshToken, current.deviceId)
  const mergedToken: OAuthToken = {
    ...current,
    ...next,
    refreshToken: next.refreshToken ?? current.refreshToken
  }
  const finalToken = await finalizeOAuthToken(provider, mergedToken)
  setProviderAuth(providerId, buildOAuthProviderPatch(provider, finalToken))
  return true
}

export async function ensureProviderAuthReady(providerId: string): Promise<boolean> {
  const provider = getProviderById(providerId)
  if (!provider) return false

  const authMode = provider.authMode ?? 'apiKey'
  if (authMode === 'apiKey') {
    if (provider.requiresApiKey === false) return true
    return !!provider.apiKey
  }

  if (authMode === 'oauth') {
    // --- Multi-account path ---
    const accounts = getAccountsArray(provider)
    if (accounts.length > 0) {
      // 1. Pick a usable account and persist any sweep/activation change.
      const { account, nextAccounts, changed } = pickUsableAccount(provider)
      if (!account) return false

      let working = provider
      if (changed || provider.activeAccountId !== account.id) {
        setProviderAuth(providerId, buildAccountProjectionPatch(provider, nextAccounts, account.id))
        working = getProviderById(providerId) ?? provider
      }

      // 2. Refresh that account's token if it's near expiry.
      let targetAccount = findAccountById(working, account.id) ?? account
      const expiresAt = targetAccount.oauth.expiresAt ?? 0
      if (expiresAt && expiresAt - Date.now() <= REFRESH_SKEW_MS) {
        try {
          const refreshed = await refreshProviderOAuth(providerId, true, targetAccount.id)
          if (!refreshed) return false
          working = getProviderById(providerId) ?? working
          targetAccount = findAccountById(working, account.id) ?? targetAccount
        } catch {
          return false
        }
      }

      // 3. Copilot: maintain derived copilotAccessToken.
      if (isCopilotProvider(working)) {
        const token = targetAccount.oauth
        const copilotExpiresAt = token.copilotExpiresAt ?? 0
        if (
          !token.copilotAccessToken ||
          (copilotExpiresAt && copilotExpiresAt - Date.now() <= REFRESH_SKEW_MS)
        ) {
          try {
            const next = await exchangeCopilotToken(working, token)
            const updatedAccount: ProviderOAuthAccount = { ...targetAccount, oauth: next }
            const updatedAccounts = upsertAccountInList(getAccountsArray(working), updatedAccount)
            setProviderAuth(
              providerId,
              buildAccountProjectionPatch(working, updatedAccounts, updatedAccount.id)
            )
            syncCopilotQuota(working, next)
            return true
          } catch {
            return false
          }
        }
        syncCopilotQuota(working, token)
      }

      // 4. Stamp lastUsedAt (best-effort, no full projection rewrite needed).
      const latest = getProviderById(providerId) ?? working
      const touched = getAccountsArray(latest).map((a) =>
        a.id === targetAccount.id ? { ...a, lastUsedAt: Date.now() } : a
      )
      setProviderAuth(providerId, {
        oauthAccounts: touched
      })
      return true
    }

    // --- Legacy single-token path (pre-migration) ---
    let latestProvider = provider
    let token = latestProvider.oauth
    if (!token?.accessToken) return false

    const expiresAt = token.expiresAt ?? 0
    if (expiresAt && expiresAt - Date.now() <= REFRESH_SKEW_MS) {
      try {
        const refreshed = await refreshProviderOAuth(providerId, true)
        if (!refreshed) return false
        latestProvider = getProviderById(providerId) ?? latestProvider
        token = latestProvider.oauth
        if (!token?.accessToken) return false
      } catch {
        return false
      }
    }

    if (isCopilotProvider(latestProvider)) {
      const copilotExpiresAt = token.copilotExpiresAt ?? 0
      if (
        !token.copilotAccessToken ||
        (copilotExpiresAt && copilotExpiresAt - Date.now() <= REFRESH_SKEW_MS)
      ) {
        try {
          const next = await exchangeCopilotToken(latestProvider, token)
          setProviderAuth(providerId, buildOAuthProviderPatch(latestProvider, next))
          return true
        } catch {
          return false
        }
      }
      const apiKey = resolveCopilotApiKey(token)
      if (!apiKey) return false
      if (
        latestProvider.apiKey !== apiKey ||
        (token.copilotApiUrl && latestProvider.baseUrl !== token.copilotApiUrl)
      ) {
        setProviderAuth(providerId, {
          apiKey,
          ...(token.copilotApiUrl ? { baseUrl: token.copilotApiUrl } : {})
        })
      }
      syncCopilotQuota(latestProvider, token)
      return true
    }

    if (!latestProvider.apiKey) {
      setProviderAuth(providerId, { apiKey: token.accessToken })
    }
    return true
  }

  if (authMode === 'channel') {
    const accessToken = provider.channel?.accessToken
    if (!accessToken) return false
    if (!provider.apiKey) {
      setProviderAuth(providerId, { apiKey: accessToken })
    }
    const expiresAt = provider.channel?.accessTokenExpiresAt
    if (expiresAt && Date.now() > expiresAt) {
      return false
    }
    return true
  }

  return false
}

export async function sendProviderChannelCode(args: {
  providerId: string
  channelType: 'sms' | 'email'
  mobile?: string
  email?: string
}): Promise<void> {
  const provider = getProviderById(args.providerId)
  if (!provider) throw new Error('Provider not found')
  if (!provider.channelConfig) throw new Error('Channel config missing')
  const appId =
    provider.channel?.appId?.trim() || provider.channelConfig?.defaultAppId?.trim() || ''
  const appToken = provider.channel?.appToken?.trim() || ''

  await sendChannelCode({
    config: provider.channelConfig,
    appId,
    appToken,
    channelType: args.channelType,
    mobile: args.mobile,
    email: args.email
  })
}

export async function verifyProviderChannelCode(args: {
  providerId: string
  channelType: 'sms' | 'email'
  code: string
  mobile?: string
  email?: string
}): Promise<void> {
  const provider = getProviderById(args.providerId)
  if (!provider) throw new Error('Provider not found')
  if (!provider.channelConfig) throw new Error('Channel config missing')
  const appId =
    provider.channel?.appId?.trim() || provider.channelConfig?.defaultAppId?.trim() || ''
  const appToken = provider.channel?.appToken?.trim() || ''

  const { accessToken } = await verifyChannelCode({
    config: provider.channelConfig,
    appId,
    appToken,
    channelType: args.channelType,
    code: args.code,
    mobile: args.mobile,
    email: args.email
  })

  let userInfo: Record<string, unknown> | undefined
  try {
    userInfo = await fetchChannelUserInfo(provider.channelConfig, accessToken)
  } catch {
    userInfo = undefined
  }

  setProviderAuth(args.providerId, {
    authMode: 'channel',
    channel: {
      appId,
      appToken,
      accessToken,
      channelType: args.channelType,
      userInfo
    },
    apiKey: accessToken
  })
}

export async function refreshProviderChannelUserInfo(providerId: string): Promise<void> {
  const provider = getProviderById(providerId)
  if (!provider?.channelConfig || !provider.channel?.accessToken) return
  const userInfo = await fetchChannelUserInfo(provider.channelConfig, provider.channel.accessToken)
  setProviderAuth(providerId, {
    channel: {
      ...(provider.channel ?? { appId: '', appToken: '' }),
      userInfo
    }
  })
}

export function clearProviderChannelAuth(providerId: string): void {
  setProviderAuth(providerId, { channel: undefined, apiKey: '' })
}
