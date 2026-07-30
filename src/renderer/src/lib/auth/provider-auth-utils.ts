import { useProviderStore } from '@renderer/stores/provider-store'
import type {
  AIProvider,
  OAuthConfig,
  OAuthToken,
  ProviderOAuthAccount
} from '@renderer/lib/api/types'

export const REFRESH_SKEW_MS = 2 * 60 * 1000

export function getProviderById(providerId: string): AIProvider | null {
  const providers = useProviderStore.getState().providers
  return providers.find((p: any) => p.id === providerId) ?? null
}

export function resolveOAuthConfig(provider: AIProvider): OAuthConfig | null {
  if (provider.oauthConfig?.authorizeUrl && provider.oauthConfig?.tokenUrl)
    return provider.oauthConfig
  return provider.oauthConfig ?? null
}

export function parseExpiryTimestamp(value: unknown): number | undefined {
  if (value == null) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.floor(value) : Math.floor(value * 1000)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const numeric = Number(trimmed)
    if (Number.isFinite(numeric)) {
      return numeric > 10_000_000_000 ? Math.floor(numeric) : Math.floor(numeric * 1000)
    }
    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed)) return parsed
  }
  return undefined
}

export function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return undefined
}

export function parseManualOAuthPayload(raw: string): AIProvider['oauth'] {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('invalid_json')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('invalid_json_object')
  }
  const payload = data as Record<string, unknown>
  const accessToken = asString(
    payload.access_token ??
      payload.accessToken ??
      payload.authorization_token ??
      payload.authorizationToken ??
      payload.auth_token ??
      payload.authToken ??
      payload.token
  )
  if (!accessToken) {
    throw new Error('missing_access_token')
  }

  const refreshToken = asString(payload.refresh_token ?? payload.refreshToken)
  const scope = asString(payload.scope)
  const tokenType = asString(payload.token_type ?? payload.tokenType)
  const accountId = asString(payload.account_id ?? payload.accountId)
  const idToken = asString(payload.id_token ?? payload.idToken)
  const deviceId = asString(payload.device_id ?? payload.deviceId)
  const copilotAccessToken = asString(
    payload.copilot_access_token ?? payload.copilotAccessToken ?? payload.oauth_token
  )
  const copilotTokenType = asString(payload.copilot_token_type ?? payload.copilotTokenType)
  const copilotApiUrl = asString(payload.copilot_api_url ?? payload.copilotApiUrl)
  const copilotSku = asString(payload.sku ?? payload.copilotSku)
  const copilotTelemetry = asString(payload.telemetry ?? payload.copilotTelemetry)
  const copilotChatEnabledRaw = payload.chat_enabled ?? payload.copilotChatEnabled
  const copilotChatEnabled =
    typeof copilotChatEnabledRaw === 'boolean'
      ? copilotChatEnabledRaw
      : typeof copilotChatEnabledRaw === 'string'
        ? ['true', '1', 'yes', 'enabled'].includes(copilotChatEnabledRaw.trim().toLowerCase())
        : undefined

  const expiresAt =
    parseExpiryTimestamp(
      payload.expires_at ??
        payload.expiresAt ??
        payload.expired ??
        payload.expireAt ??
        payload.expire_at
    ) ??
    (() => {
      const expiresInRaw = payload.expires_in ?? payload.expiresIn
      const expiresIn =
        typeof expiresInRaw === 'number'
          ? expiresInRaw
          : typeof expiresInRaw === 'string'
            ? Number(expiresInRaw)
            : NaN
      return Number.isFinite(expiresIn) ? Date.now() + (expiresIn as number) * 1000 : undefined
    })()

  const copilotExpiresAt =
    parseExpiryTimestamp(payload.copilot_expires_at ?? payload.copilotExpiresAt) ??
    (() => {
      const expiresInRaw = payload.copilot_expires_in ?? payload.copilotExpiresIn
      const expiresIn =
        typeof expiresInRaw === 'number'
          ? expiresInRaw
          : typeof expiresInRaw === 'string'
            ? Number(expiresInRaw)
            : NaN
      return Number.isFinite(expiresIn) ? Date.now() + (expiresIn as number) * 1000 : undefined
    })()

  return {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    ...(expiresAt ? { expiresAt } : {}),
    ...(scope ? { scope } : {}),
    ...(tokenType ? { tokenType } : {}),
    ...(accountId ? { accountId } : {}),
    ...(idToken ? { idToken } : {}),
    ...(deviceId ? { deviceId } : {}),
    ...(copilotAccessToken ? { copilotAccessToken } : {}),
    ...(copilotTokenType ? { copilotTokenType } : {}),
    ...(copilotExpiresAt ? { copilotExpiresAt } : {}),
    ...(copilotApiUrl ? { copilotApiUrl } : {}),
    ...(copilotSku ? { copilotSku } : {}),
    ...(copilotTelemetry ? { copilotTelemetry } : {}),
    ...(copilotChatEnabled !== undefined ? { copilotChatEnabled } : {})
  }
}

export function setProviderAuth(providerId: string, patch: Partial<AIProvider>): void {
  useProviderStore.getState().updateProvider(providerId, patch)
}

/** Extract a usable email hint from an OAuth token (id_token claim or known fields). */
export function extractEmailFromToken(token: OAuthToken): string | undefined {
  // Try id_token payload: base64url middle segment
  const idToken = token.idToken
  if (idToken && idToken.split('.').length === 3) {
    try {
      const payload = idToken.split('.')[1]
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
      const data = JSON.parse(json) as Record<string, unknown>
      const email = asString(data.email)
      if (email) return email
    } catch {
      // ignore — malformed id_token
    }
  }
  return undefined
}

/** Decide if an account should be considered rate-limited right now. Self-heals when resetAt elapses. */
export function isAccountRateLimited(account: ProviderOAuthAccount): boolean {
  if (!account.rateLimit) return false
  if (account.rateLimit.resetAt <= Date.now()) return false
  return true
}

export function getAccountsArray(provider: AIProvider): ProviderOAuthAccount[] {
  return provider.oauthAccounts ?? []
}

export function findAccountById(
  provider: AIProvider,
  accountId: string | undefined
): ProviderOAuthAccount | undefined {
  if (!accountId) return undefined
  return getAccountsArray(provider).find((a) => a.id === accountId)
}

/**
 * Pick the next account to use for a provider.
 *   1. Sweep: remove rateLimit markers whose resetAt has elapsed.
 *   2. Prefer the currently active account if it's usable.
 *   3. Otherwise walk the list in order and return the first non-rate-limited entry.
 *   4. If all are rate-limited, return the one with the earliest resetAt (best-effort retry).
 *   5. If the list is empty, return null.
 *
 * Returns {account, accountsChanged, nextAccounts} so callers can persist the swept state.
 */
export function pickUsableAccount(provider: AIProvider): {
  account: ProviderOAuthAccount | null
  nextAccounts: ProviderOAuthAccount[]
  changed: boolean
} {
  const accounts = getAccountsArray(provider)
  if (accounts.length === 0) {
    return { account: null, nextAccounts: accounts, changed: false }
  }

  const now = Date.now()
  let changed = false
  const swept: ProviderOAuthAccount[] = accounts.map((acc) => {
    if (acc.rateLimit && acc.rateLimit.resetAt <= now) {
      changed = true
      const { rateLimit: _rl, ...rest } = acc
      return rest as ProviderOAuthAccount
    }
    return acc
  })

  const activeId = provider.activeAccountId
  if (activeId) {
    const active = swept.find((a) => a.id === activeId)
    if (active && !isAccountRateLimited(active)) {
      return { account: active, nextAccounts: swept, changed }
    }
  }

  const firstUsable = swept.find((a) => !isAccountRateLimited(a))
  if (firstUsable) {
    return { account: firstUsable, nextAccounts: swept, changed }
  }

  const earliest = [...swept].sort(
    (a, b) => (a.rateLimit?.resetAt ?? 0) - (b.rateLimit?.resetAt ?? 0)
  )[0]
  return { account: earliest ?? null, nextAccounts: swept, changed }
}
