import { nanoid } from 'nanoid'
import { useProviderStore } from '@renderer/stores/provider-store'
import { getProviderById, resolveOAuthConfig, parseExpiryTimestamp, asString, setProviderAuth, extractEmailFromToken, isAccountRateLimited, getAccountsArray, findAccountById, pickUsableAccount, REFRESH_SKEW_MS } from './provider-auth-utils'
import type { AIProvider, ProviderOAuthAccount } from '@renderer/lib/api/types'
import { clearCopilotQuota, isCopilotProvider, resolveCopilotApiKey, syncCopilotQuota } from './copilot'
import { StartOAuthFlowOptions } from './oauth-utils'

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

  // Prefer active account when it's still usable.
  const activeId = provider.activeAccountId
  if (activeId) {
    const active = swept.find((a) => a.id === activeId)
    if (active && !isAccountRateLimited(active)) {
      return { account: active, nextAccounts: swept, changed }
    }
  }

  // Otherwise first non-rate-limited in priority order.
  const firstUsable = swept.find((a) => !isAccountRateLimited(a))
  if (firstUsable) {
    return { account: firstUsable, nextAccounts: swept, changed }
  }

  // All limited → return the one with the earliest resetAt so we still attempt something.
  const earliest = [...swept].sort(
    (a, b) => (a.rateLimit?.resetAt ?? 0) - (b.rateLimit?.resetAt ?? 0)
  )[0]
  return { account: earliest ?? null, nextAccounts: swept, changed }
}

function buildOAuthProviderPatch(provider: AIProvider, token: OAuthToken): Partial<AIProvider> {
  const apiKey = getProviderApiKey(provider, token)
  const patch: Partial<AIProvider> = {
    authMode: 'oauth',
    oauth: token,
    apiKey
  }
  if (isCopilotProvider(provider) && token.copilotApiUrl) {
    patch.baseUrl = token.copilotApiUrl
  }
  return patch
}

/**
 * Build a provider patch that: replaces the accounts array, updates activeAccountId,
 * and projects the active account's token into the top-level oauth/apiKey/baseUrl fields
 * so provider consumers see the current account transparently.
 */
function buildAccountProjectionPatch(
  provider: AIProvider,
  accounts: ProviderOAuthAccount[],
  activeAccountId: string
): Partial<AIProvider> {
  const active = accounts.find((a) => a.id === activeAccountId)
  const patch: Partial<AIProvider> = {
    authMode: 'oauth',
    oauthAccounts: accounts,
    activeAccountId
  }
  if (active) {
    patch.oauth = active.oauth
    patch.apiKey = getProviderApiKey(provider, active.oauth)
    if (isCopilotProvider(provider) && active.oauth.copilotApiUrl) {
      patch.baseUrl = active.oauth.copilotApiUrl
    }
  } else {
    patch.oauth = undefined
    patch.apiKey = ''
  }
  return patch
}

function upsertAccountInList(
  accounts: ProviderOAuthAccount[],
  account: ProviderOAuthAccount
): ProviderOAuthAccount[] {
  const idx = accounts.findIndex((a) => a.id === account.id)
  if (idx >= 0) {
    const next = accounts.slice()
    next[idx] = account
    return next
  }
  return [...accounts, account]
}

function requiresOAuthConnectConfig(config: OAuthConfig | null): boolean {
  if (!config?.tokenUrl || !config.clientId) return false
  if ((config.flowType ?? 'authorization_code') === 'device_code') {
    return !!config.deviceCodeUrl
  }
  return !!config.authorizeUrl
}

function getProviderApiKey(provider: AIProvider, token: OAuthToken): string {
  return isCopilotProvider(provider) ? resolveCopilotApiKey(token) : token.accessToken
}

async function finalizeOAuthToken(provider: AIProvider, token: OAuthToken): Promise<OAuthToken> {
  if (!isCopilotProvider(provider)) {
    return token
  }
  const next =
    token.copilotAccessToken &&
    token.copilotExpiresAt &&
    token.copilotExpiresAt - Date.now() > REFRESH_SKEW_MS
      ? token
      : await exchangeCopilotToken(provider, token)
  syncCopilotQuota(provider, next)
  return next
}

/**
 * Start an OAuth login flow and add the resulting token as a NEW account entry.
 * If `email` is not supplied, we try to infer it from the id_token claim; if that
 * fails we fall back to a placeholder so the UI can prompt the user to complete it.
 *
 * Callers that still want single-account semantics can rely on the fact that the
 * active account is always set to the first entry when the list was previously empty.
 */
export async function startProviderOAuth(
  providerId: string,
  options?: AbortSignal | StartOAuthFlowOptions,
  email?: string
): Promise<ProviderOAuthAccount> {
  const provider = getProviderById(providerId)
  if (!provider) throw new Error('Provider not found')
  const config = resolveOAuthConfig(provider)
  if (!requiresOAuthConnectConfig(config) || !config) {
    throw new Error('OAuth config is incomplete')
  }

  const token = await startOAuthFlow(config, options)
  const finalToken = await finalizeOAuthToken(provider, token)

  const resolvedEmail =
    email?.trim() || extractEmailFromToken(finalToken) || finalToken.accountId || 'unknown@local'

  const account: ProviderOAuthAccount = {
    id: nanoid(),
    email: resolvedEmail,
    oauth: finalToken,
    createdAt: Date.now(),
    lastUsedAt: Date.now()
  }

  const latest = getProviderById(providerId) ?? provider
  const existing = getAccountsArray(latest)
  const nextAccounts = [...existing, account]
  setProviderAuth(
    providerId,
    buildAccountProjectionPatch(
      latest,
      nextAccounts,
      latest.activeAccountId && existing.some((a) => a.id === latest.activeAccountId)
        ? latest.activeAccountId
        : account.id
    )
  )
  return account
}

/** Remove a specific account. If it was active, the next usable account becomes active. */
export function removeOauthAccount(providerId: string, accountId: string): void {
  const provider = getProviderById(providerId)
  if (!provider) return
  const nextAccounts = getAccountsArray(provider).filter((a) => a.id !== accountId)
  if (nextAccounts.length === 0) {
    if (isCopilotProvider(provider)) clearCopilotQuota(provider)
    setProviderAuth(providerId, {
      oauth: undefined,
      apiKey: '',
      oauthAccounts: [],
      activeAccountId: undefined
    })
    return
  }
  const nextActiveId =
    provider.activeAccountId === accountId ? nextAccounts[0].id : provider.activeAccountId!
  setProviderAuth(providerId, buildAccountProjectionPatch(provider, nextAccounts, nextActiveId))
}

/** Disconnect ALL OAuth accounts for this provider (legacy "disconnect OAuth" button). */
export function disconnectProviderOAuth(providerId: string): void {
  const provider = getProviderById(providerId)
  if (provider && isCopilotProvider(provider)) {
    clearCopilotQuota(provider)
  }
  setProviderAuth(providerId, {
    oauth: undefined,
    apiKey: '',
    oauthAccounts: [],
    activeAccountId: undefined
  })
}

/** Set a specific account as active for subsequent requests. */
export function setActiveProviderAccount(providerId: string, accountId: string): void {
  const provider = getProviderById(providerId)
  if (!provider) return
  const accounts = getAccountsArray(provider)
  if (!accounts.some((a) => a.id === accountId)) return
  setProviderAuth(providerId, buildAccountProjectionPatch(provider, accounts, accountId))
}

/** Reorder the accounts array (priority order is array order). */
export function reorderProviderAccounts(providerId: string, orderedIds: string[]): void {
  const provider = getProviderById(providerId)
  if (!provider) return
  const byId = new Map(getAccountsArray(provider).map((a) => [a.id, a] as const))
  const next: ProviderOAuthAccount[] = []
  for (const id of orderedIds) {
    const acc = byId.get(id)
    if (acc) {
      next.push(acc)
      byId.delete(id)
    }
  }
  // Append any accounts that weren't in the provided order (defensive).
  for (const acc of byId.values()) next.push(acc)
  const activeId =
    provider.activeAccountId && next.some((a) => a.id === provider.activeAccountId)
      ? provider.activeAccountId
      : next[0]?.id
  if (!activeId) return
  setProviderAuth(providerId, buildAccountProjectionPatch(provider, next, activeId))
}

/** Update email/label metadata on an account. */
export function updateProviderAccountInfo(
  providerId: string,
  accountId: string,
  patch: { email?: string; label?: string }
): void {
  const provider = getProviderById(providerId)
  if (!provider) return
  const accounts = getAccountsArray(provider).map((a) => {
    if (a.id !== accountId) return a
    return {
      ...a,
      ...(patch.email !== undefined ? { email: patch.email.trim() || a.email } : {}),
      ...(patch.label !== undefined ? { label: patch.label.trim() || undefined } : {})
    }
  })
  setProviderAuth(
    providerId,
    buildAccountProjectionPatch(provider, accounts, provider.activeAccountId ?? accounts[0].id)
  )
}

/** Mark an account as rate-limited until `resetAt`. Triggers automatic fall-back via pickUsableAccount. */
export function markAccountRateLimited(
  providerId: string,
  accountId: string,
  info: Omit<AccountRateLimit, 'limitedAt'>
): void {
  const provider = getProviderById(providerId)
  if (!provider) return
  const accounts = getAccountsArray(provider).map((a) =>
    a.id === accountId
      ? { ...a, rateLimit: { limitedAt: Date.now(), ...info } satisfies AccountRateLimit }
      : a
  )
  if (accounts.length === 0) return
  const { account: next } = pickUsableAccount({ ...provider, oauthAccounts: accounts })
  const nextActiveId = next?.id ?? provider.activeAccountId ?? accounts[0].id
  setProviderAuth(providerId, buildAccountProjectionPatch(provider, accounts, nextActiveId))
}

/**
 * Attempt to switch the provider to a different usable account.
 * Returns the previous accountId and the new one if a switch happened, else null.
 * Used by the agent loop to fail over after a rate-limit error.
 */
export function trySwitchProviderAccount(providerId: string): {
  previousAccountId: string | undefined
  nextAccountId: string
} | null {
  const provider = getProviderById(providerId)
  if (!provider) return null
  const accounts = getAccountsArray(provider)
  if (accounts.length < 2) return null
  const previousAccountId = provider.activeAccountId
  const others = accounts.filter((a) => a.id !== previousAccountId && !isAccountRateLimited(a))
  if (others.length === 0) return null
  const next = others[0]
  setProviderAuth(providerId, buildAccountProjectionPatch(provider, accounts, next.id))
  return { previousAccountId, nextAccountId: next.id }
}

/** True when the provider has more than one OAuth account registered. */
export function hasMultipleOauthAccounts(providerId: string): boolean {
  const provider = getProviderById(providerId)
  return !!provider && getAccountsArray(provider).length > 1
}

/** Clear the rate-limit flag on an account (user-initiated "reactivate"). */
export function clearAccountRateLimit(providerId: string, accountId: string): void {
  const provider = getProviderById(providerId)
  if (!provider) return
  const accounts = getAccountsArray(provider).map((a) =>
    a.id === accountId ? { ...a, rateLimit: undefined } : a
  )
  setProviderAuth(
    providerId,
    buildAccountProjectionPatch(
      provider,
      accounts,
      provider.activeAccountId ?? accounts[0]?.id ?? ''
    )
  )
}

/**
 * Parse a single OAuth record. Reuses parseManualOAuthPayload but requires an `email` field
 * to be present either at the top level or as a sibling of the token keys.
 */
function parseImportRecord(record: unknown): { email: string; token: OAuthToken; label?: string } {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('invalid_record')
  }
  const raw = record as Record<string, unknown>
  const email = asString(raw.email)
  if (!email) throw new Error('missing_email')
  const label = asString(raw.label ?? raw.name ?? raw.nickname)
  const token = parseManualOAuthPayload(JSON.stringify(raw))
  if (!token) throw new Error('invalid_token')
  return { email, token, ...(label ? { label } : {}) }
}

/** Apply a manually-pasted OAuth JSON as a NEW account (requires email). */
export async function applyManualProviderOAuth(
  providerId: string,
  rawJson: string,
  email?: string
): Promise<ProviderOAuthAccount> {
  const provider = getProviderById(providerId)
  if (!provider) throw new Error('Provider not found')

  // Backwards-compatible path: legacy single-account JSON without an email wrapper.
  let resolvedEmail = email?.trim()
  let token: OAuthToken | undefined
  try {
    // First try as a full import record with email.
    const parsed = parseImportRecord(JSON.parse(rawJson))
    resolvedEmail = resolvedEmail || parsed.email
    token = parsed.token
  } catch {
    token = parseManualOAuthPayload(rawJson)
    if (!token) throw new Error('Invalid OAuth payload')
  }
  const finalToken = await finalizeOAuthToken(provider, token)
  if (!resolvedEmail) {
    resolvedEmail = extractEmailFromToken(finalToken) || finalToken.accountId || 'unknown@local'
  }

  const account: ProviderOAuthAccount = {
    id: nanoid(),
    email: resolvedEmail,
    oauth: finalToken,
    createdAt: Date.now()
  }
  const latest = getProviderById(providerId) ?? provider
  const nextAccounts = [...getAccountsArray(latest), account]
  setProviderAuth(
    providerId,
    buildAccountProjectionPatch(
      latest,
      nextAccounts,
      latest.activeAccountId &&
        getAccountsArray(latest).some((a) => a.id === latest.activeAccountId)
        ? latest.activeAccountId
        : account.id
    )
  )
  return account
}


// Import/export account functions extracted to provider-auth-accounts.ts
export type {
  ImportOAuthAccountsResult,
} from './provider-auth-accounts'

export {
  importOauthAccountsFromJson,
  refreshProviderOAuth,
  ensureProviderAuthReady,
  sendProviderChannelCode,
  verifyProviderChannelCode,
  refreshProviderChannelUserInfo,
} from './provider-auth-accounts'

export {
  exportProviderAccounts,
  clearProviderChannelAuth,
} from './provider-auth-accounts'
