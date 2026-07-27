import { nanoid } from 'nanoid'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'
import type { OAuthConfig, OAuthToken } from '@renderer/lib/api/types'
import { isMoonshotOAuthConfig, isMoonshotProviderConfig, buildMoonshotCommonHeaders, KIMI_CLIENT_ID, KIMI_CLIENT_VERSION } from './oauth-utils'
import type { StartOAuthFlowOptions } from './oauth-utils'
import { OAuthDeviceCodeInfo } from './oauth-utils'
export type { StartOAuthFlowOptions } from './oauth-utils'

function buildAuthorizeUrl(config: OAuthConfig, params: Record<string, string>): string {
  const url = new URL(config.authorizeUrl)
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value)
  })
  if (config.extraParams) {
    Object.entries(config.extraParams).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value)
    })
  }
  return url.toString()
}

function parseJwtAccountId(token: string | undefined): string | undefined {
  if (!token) return undefined
  const parts = token.split('.')
  if (parts.length < 2) return undefined
  const payload = parts[1]
  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
    const json = JSON.parse(decoded) as Record<string, unknown>
    const accountId =
      (typeof json.account_id === 'string' && json.account_id) ||
      (typeof json.accountId === 'string' && json.accountId) ||
      (typeof json.sub === 'string' && json.sub)
    return accountId || undefined
  } catch {
    return undefined
  }
}

function parseExpiryTimestamp(value: unknown): number | undefined {
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

function normalizeTokenResponse(raw: Record<string, unknown>, deviceId?: string): OAuthToken {
  const accessToken = String(raw.access_token ?? '')
  const refreshToken = raw.refresh_token ? String(raw.refresh_token) : undefined
  const scope = raw.scope ? String(raw.scope) : undefined
  const tokenType = raw.token_type ? String(raw.token_type) : undefined
  const idToken = raw.id_token ? String(raw.id_token) : undefined

  const expiresIn =
    typeof raw.expires_in === 'number'
      ? raw.expires_in
      : typeof raw.expiresIn === 'number'
        ? raw.expiresIn
        : Number(raw.expires_in ?? raw.expiresIn)
  const expiresAt =
    parseExpiryTimestamp(
      raw.expires_at ??
        raw.expiresAt ??
        raw.expired_at ??
        raw.expiredAt ??
        raw.expire_at ??
        raw.expireAt
    ) ?? (Number.isFinite(expiresIn) ? Date.now() + expiresIn * 1000 : undefined)
  const accountId =
    (typeof raw.account_id === 'string' && raw.account_id) ||
    (typeof raw.accountId === 'string' && raw.accountId) ||
    parseJwtAccountId(accessToken)

  return {
    accessToken,
    refreshToken,
    expiresAt,
    scope,
    tokenType,
    accountId,
    ...(idToken ? { idToken } : {}),
    ...(deviceId ? { deviceId } : {})
  }
}

function buildTokenHeaders(
  mode: 'form' | 'json',
  overrides?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = { ...(overrides ?? {}) }
  if (!headers['Content-Type']) {
    headers['Content-Type'] =
      mode === 'json' ? 'application/json' : 'application/x-www-form-urlencoded'
  }
  if (!headers.Accept) {
    headers.Accept = 'application/json'
  }
  return headers
}

async function buildOAuthRequestHeaders(
  config: OAuthConfig,
  mode: 'form' | 'json',
  overrides?: Record<string, string>,
  deviceId?: string
): Promise<Record<string, string>> {
  const headers = buildTokenHeaders(mode, overrides)
  if (!isMoonshotOAuthConfig(config)) return headers
  return {
    ...(await buildMoonshotCommonHeaders(deviceId)),
    ...headers
  }
}

async function requestOAuthJson(args: {
  url: string
  body: string
  headers: Record<string, string>
  useSystemProxy?: boolean
}): Promise<{ statusCode?: number; data: Record<string, unknown>; rawBody: string }> {
  const result = (await ipcClient.invoke('api:request', {
    url: args.url,
    method: 'POST',
    headers: args.headers,
    body: args.body,
    useSystemProxy: args.useSystemProxy
  })) as { statusCode?: number; error?: string; body?: string }

  if (result?.error) {
    throw new Error(result.error)
  }
  if (!result?.body) {
    throw new Error('Empty token response')
  }

  let data: Record<string, unknown>
  try {
    data = JSON.parse(result.body) as Record<string, unknown>
  } catch {
    const snippet = result.body.slice(0, 500)
    console.error(
      `[OAuth] JSON parse failed for ${args.url} status=${result.statusCode} body=${snippet}`
    )
    if (result.statusCode && result.statusCode >= 400) {
      throw new Error(`HTTP ${result.statusCode}: ${snippet}`)
    }
    throw new Error(`Invalid JSON token response: ${snippet}`)
  }

  return { statusCode: result.statusCode, data, rawBody: result.body }
}

async function sendTokenRequest(
  config: OAuthConfig,
  body: string,
  headers: Record<string, string>,
  deviceId?: string
): Promise<OAuthToken> {
  const { statusCode, data, rawBody } = await requestOAuthJson({
    url: config.tokenUrl,
    body,
    headers,
    useSystemProxy: config.useSystemProxy
  })

  if (statusCode && statusCode >= 400) {
    throw new Error(`HTTP ${statusCode}: ${rawBody.slice(0, 200)}`)
  }

  const token = normalizeTokenResponse(data, deviceId)
  if (!token.accessToken) {
    throw new Error('Missing access_token in response')
  }
  return token
}

async function exchangeToken(config: OAuthConfig, body: URLSearchParams): Promise<OAuthToken> {
  const mode = config.tokenRequestMode ?? 'form'
  const headers = await buildOAuthRequestHeaders(config, mode, config.tokenRequestHeaders)
  const bodyStr = mode === 'json' ? JSON.stringify(Object.fromEntries(body)) : body.toString()
  return sendTokenRequest(config, bodyStr, headers)
}

async function requestDeviceCode(config: OAuthConfig): Promise<OAuthDeviceCodeInfo> {
  if (!config.deviceCodeUrl || !config.clientId) {
    throw new Error('OAuth device flow config missing deviceCodeUrl/clientId')
  }

  const mode = config.deviceCodeRequestMode ?? 'form'
  const deviceId = isMoonshotOAuthConfig(config) ? randomHex(16) : undefined
  const headers = await buildOAuthRequestHeaders(
    config,
    mode,
    config.deviceCodeRequestHeaders,
    deviceId
  )
  const body = new URLSearchParams()
  body.set('client_id', config.clientId)
  if (config.scope) {
    body.set('scope', config.scope)
  }

  const { statusCode, data, rawBody } = await requestOAuthJson({
    url: config.deviceCodeUrl,
    body: mode === 'json' ? JSON.stringify(Object.fromEntries(body)) : body.toString(),
    headers,
    useSystemProxy: config.useSystemProxy
  })

  if (statusCode && statusCode >= 400) {
    throw new Error(`HTTP ${statusCode}: ${rawBody.slice(0, 200)}`)
  }

  const deviceCode = typeof data.device_code === 'string' ? data.device_code.trim() : ''
  const userCode = typeof data.user_code === 'string' ? data.user_code.trim() : ''
  const verificationUri =
    typeof data.verification_uri === 'string' ? data.verification_uri.trim() : ''
  const verificationUriComplete =
    typeof data.verification_uri_complete === 'string'
      ? data.verification_uri_complete.trim()
      : undefined
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : Number(data.expires_in)
  const intervalSeconds =
    typeof data.interval === 'number' ? data.interval : Number(data.interval ?? 5)

  if (!deviceCode || !userCode || !verificationUri) {
    throw new Error('Device authorization response missing required fields')
  }

  return {
    deviceCode,
    userCode,
    verificationUri,
    ...(verificationUriComplete ? { verificationUriComplete } : {}),
    ...(Number.isFinite(expiresIn) ? { expiresAt: Date.now() + expiresIn * 1000 } : {}),
    ...(Number.isFinite(intervalSeconds) ? { intervalSeconds } : {}),
    ...(deviceId ? { deviceId } : {})
  }
}

async function pollDeviceToken(
  config: OAuthConfig,
  device: OAuthDeviceCodeInfo,
  signal?: AbortSignal
): Promise<OAuthToken> {
  const mode = config.tokenRequestMode ?? 'form'
  let intervalSeconds = Math.max(1, device.intervalSeconds ?? 5)

  while (true) {
    if (signal?.aborted) {
      throw createAbortError()
    }
    if (device.expiresAt && Date.now() >= device.expiresAt) {
      throw new Error('Device code expired')
    }

    const body = new URLSearchParams()
    body.set('grant_type', 'urn:ietf:params:oauth:grant-type:device_code')
    body.set('client_id', config.clientId)
    body.set('device_code', device.deviceCode)

    const headers = await buildOAuthRequestHeaders(
      config,
      mode,
      config.tokenRequestHeaders,
      device.deviceId
    )
    const requestBody = mode === 'json' ? JSON.stringify(Object.fromEntries(body)) : body.toString()

    const { statusCode, data, rawBody } = await requestOAuthJson({
      url: config.tokenUrl,
      body: requestBody,
      headers,
      useSystemProxy: config.useSystemProxy
    })

    const token = normalizeTokenResponse(data, device.deviceId)
    if (token.accessToken) {
      return token
    }

    const errorCode = typeof data.error === 'string' ? data.error : ''
    if (errorCode === 'authorization_pending') {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, intervalSeconds * 1000)
        if (signal) {
          const onAbort = (): void => {
            clearTimeout(timer)
            signal.removeEventListener('abort', onAbort)
            reject(createAbortError())
          }
          signal.addEventListener('abort', onAbort, { once: true })
        }
      })
      continue
    }
    if (errorCode === 'slow_down') {
      intervalSeconds += 5
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, intervalSeconds * 1000)
        if (signal) {
          const onAbort = (): void => {
            clearTimeout(timer)
            signal.removeEventListener('abort', onAbort)
            reject(createAbortError())
          }
          signal.addEventListener('abort', onAbort, { once: true })
        }
      })
      continue
    }
    if (statusCode && statusCode >= 400) {
      throw new Error(`HTTP ${statusCode}: ${rawBody.slice(0, 200)}`)
    }
    throw new Error(errorCode || 'Device authorization failed')
  }
}

function waitForCallback(
  requestId: string,
  timeoutMs = 300000,
  signal?: AbortSignal
): Promise<OAuthCallbackPayload> {
  return new Promise((resolve, reject) => {
    let done = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const stop = ipcClient.on(IPC.OAUTH_CALLBACK, (...args: unknown[]) => {
      const payload = args[0] as OAuthCallbackPayload
      if (payload.requestId !== requestId) return
      cleanup()
      resolve(payload)
    })

    const cleanup = (): void => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      stop()
      if (signal) signal.removeEventListener('abort', onAbort)
    }

    const onAbort = (): void => {
      cleanup()
      const err = new Error('OAuth cancelled')
      err.name = 'AbortError'
      reject(err)
    }

    if (signal?.aborted) {
      onAbort()
      return
    }
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true })
    }

    timer = setTimeout(() => {
      cleanup()
      reject(new Error('OAuth timed out'))
    }, timeoutMs)
  })
}

function createAbortError(): Error {
  const err = new Error('OAuth cancelled')
  err.name = 'AbortError'
  return err
}

export async function startOAuthFlow(
  config: OAuthConfig,
  signalOrOptions?: AbortSignal | StartOAuthFlowOptions
): Promise<OAuthToken> {
  const options =
    signalOrOptions && 'aborted' in signalOrOptions
      ? { signal: signalOrOptions }
      : (signalOrOptions ?? {})
  const signal = options.signal
  const flowType = config.flowType ?? 'authorization_code'

  if (!config.tokenUrl || !config.clientId) {
    throw new Error('OAuth config missing tokenUrl/clientId')
  }
  if (signal?.aborted) {
    throw createAbortError()
  }

  if (flowType === 'device_code') {
    const device = await requestDeviceCode(config)
    options.onDeviceCode?.(device)
    const openUrl = device.verificationUriComplete || device.verificationUri
    if (openUrl) {
      await ipcClient.invoke('shell:openExternal', openUrl)
    }
    return pollDeviceToken(config, device, signal)
  }

  if (!config.authorizeUrl) {
    throw new Error('OAuth config missing authorizeUrl for authorization code flow')
  }

  const requestId = nanoid()
  const usePkce = config.usePkce !== false
  const state = randomString(32)
  const codeVerifier = usePkce ? randomString(64) : ''
  const codeChallenge = usePkce ? await sha256(codeVerifier) : ''

  const startResult = (await ipcClient.invoke(IPC.OAUTH_START, {
    requestId,
    port: config.redirectPort,
    path: config.redirectPath,
    expectedState: state
  })) as { port?: number; redirectUri?: string; error?: string }

  if (startResult?.error) {
    throw new Error(startResult.error)
  }
  const redirectUri = startResult.redirectUri
  if (!redirectUri) {
    throw new Error('Failed to start OAuth callback server')
  }
  if (signal?.aborted) {
    await ipcClient.invoke(IPC.OAUTH_STOP, { requestId })
    throw createAbortError()
  }

  const authorizeUrl = buildAuthorizeUrl(config, {
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: config.scope ?? '',
    state,
    ...(usePkce
      ? {
          code_challenge: codeChallenge,
          code_challenge_method: 'S256'
        }
      : {})
  })

  await ipcClient.invoke('shell:openExternal', authorizeUrl)

  let callback: OAuthCallbackPayload
  try {
    callback = await waitForCallback(requestId, 300000, signal)
  } finally {
    await ipcClient.invoke(IPC.OAUTH_STOP, { requestId })
  }

  if (callback.error) {
    throw new Error(callback.errorDescription || callback.error)
  }
  if (!callback.code) {
    throw new Error('OAuth callback missing code')
  }

  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('client_id', config.clientId)
  body.set('code', callback.code)
  body.set('redirect_uri', redirectUri)
  if (usePkce) body.set('code_verifier', codeVerifier)
  if (config.scope && config.includeScopeInTokenRequest !== false) {
    body.set('scope', config.scope)
  }

  return exchangeToken(config, body)
}

export async function refreshOAuthFlow(
  config: OAuthConfig,
  refreshToken: string,
  deviceId?: string
): Promise<OAuthToken> {
  if (!config.tokenUrl || !config.clientId) {
    throw new Error('OAuth config missing tokenUrl/clientId')
  }

  const mode = config.refreshRequestMode ?? 'form'
  const scope = config.refreshScope ?? config.scope
  const headers = await buildOAuthRequestHeaders(
    config,
    mode,
    config.refreshRequestHeaders,
    deviceId
  )

  if (mode === 'json') {
    const payload: Record<string, string> = {
      grant_type: 'refresh_token',
      client_id: config.clientId,
      refresh_token: refreshToken
    }
    if (scope) payload.scope = scope
    return sendTokenRequest(config, JSON.stringify(payload), headers, deviceId)
  }

  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('client_id', config.clientId)
  body.set('refresh_token', refreshToken)
  if (scope) body.set('scope', scope)

  return sendTokenRequest(config, body.toString(), headers, deviceId)
}
