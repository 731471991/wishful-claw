import { randomBytes } from 'crypto'
import {
  DEFAULT_WEIXIN_BASE_URL,
  type WeixinGetUploadUrlResponse
} from './weixin-types'
import {
  encryptAesEcb,
  buildCdnUploadUrl
} from './weixin-crypto'

export function normalizeBaseUrl(baseUrl: string): string {
  return (baseUrl || DEFAULT_WEIXIN_BASE_URL).replace(/\/+$/, '')
}

export function buildXWechatUin(): string {
  const value = randomBytes(4).readUInt32BE(0)
  return Buffer.from(String(value), 'utf8').toString('base64')
}

export function buildHeaders(
  token?: string,
  routeTag?: string,
  wechatUin?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    AuthorizationType: 'ilink_bot_token'
  }

  if (wechatUin) {
    headers['X-WECHAT-UIN'] = wechatUin
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  if (routeTag) {
    headers.SKRouteTag = routeTag
  }
  return headers
}

export async function postJson<T>(params: {
  baseUrl: string
  path: string
  body: unknown
  token?: string
  routeTag?: string
  wechatUin?: string
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 40000)
  const signal = params.signal
    ? AbortSignal.any([params.signal, controller.signal])
    : controller.signal

  try {
    const response = await fetch(`${normalizeBaseUrl(params.baseUrl)}/${params.path}`, {
      method: 'POST',
      headers: buildHeaders(params.token, params.routeTag, params.wechatUin),
      body: JSON.stringify(params.body),
      signal
    })

    const rawText = await response.text()
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${rawText || response.statusText}`)
    }

    return rawText ? (JSON.parse(rawText) as T) : ({} as T)
  } finally {
    clearTimeout(timeout)
  }
}

export async function postBinary(params: {
  baseUrl: string
  path: string
  body: unknown
  token?: string
  routeTag?: string
  wechatUin?: string
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<{ buffer: Buffer; mediaType: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 40000)
  const signal = params.signal
    ? AbortSignal.any([params.signal, controller.signal])
    : controller.signal

  try {
    const response = await fetch(`${normalizeBaseUrl(params.baseUrl)}/${params.path}`, {
      method: 'POST',
      headers: buildHeaders(params.token, params.routeTag, params.wechatUin),
      body: JSON.stringify(params.body),
      signal
    })

    if (!response.ok) {
      const rawText = await response.text().catch(() => '')
      throw new Error(`HTTP ${response.status}: ${rawText || response.statusText}`)
    }

    const mediaType = response.headers.get('content-type') || 'application/octet-stream'
    const buffer = Buffer.from(await response.arrayBuffer())
    return { buffer, mediaType }
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchBinary(
  url: string,
  timeoutMs = 20000,
  signal?: AbortSignal
): Promise<{ buffer: Buffer; mediaType: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const effectiveSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal

  try {
    const response = await fetch(url, { method: 'GET', signal: effectiveSignal })
    if (!response.ok) {
      const rawText = await response.text().catch(() => '')
      throw new Error(`HTTP ${response.status}: ${rawText || response.statusText}`)
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mediaType: response.headers.get('content-type') || 'application/octet-stream'
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function uploadBufferToCdn(params: {
  buffer: Buffer
  uploadParam?: string
  uploadFullUrl?: string
  fileKey: string
  cdnBaseUrl: string
  aesKey: Buffer
  signal?: AbortSignal
}): Promise<string> {
  const ciphertext = encryptAesEcb(params.buffer, params.aesKey)
  const url = params.uploadFullUrl?.trim()
    ? params.uploadFullUrl.trim()
    : params.uploadParam
      ? buildCdnUploadUrl(params.cdnBaseUrl, params.uploadParam, params.fileKey)
      : ''
  if (!url) {
    throw new Error('Weixin CDN upload missing upload URL')
  }

  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      const signal = params.signal
        ? AbortSignal.any([params.signal, controller.signal])
        : controller.signal

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: new Uint8Array(ciphertext),
          signal
        })

        if (response.status >= 400 && response.status < 500) {
          const rawText =
            response.headers.get('x-error-message') || (await response.text().catch(() => ''))
          throw new Error(
            `Weixin CDN upload client error ${response.status}: ${rawText || response.statusText}`
          )
        }
        if (response.status !== 200) {
          const rawText =
            response.headers.get('x-error-message') || (await response.text().catch(() => ''))
          throw new Error(
            `Weixin CDN upload server error ${response.status}: ${rawText || response.statusText}`
          )
        }

        const downloadParam = response.headers.get('x-encrypted-param') || ''
        if (!downloadParam) {
          throw new Error('Weixin CDN upload response missing x-encrypted-param header')
        }
        return downloadParam
      } finally {
        clearTimeout(timeout)
      }
    } catch (error) {
      lastError = error
      if (
        error instanceof Error &&
        (error.message.includes('client error') ||
          error.message.includes('missing x-encrypted-param'))
      ) {
        throw error
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Weixin CDN upload failed')
}

export function normalizeUploadUrlResponse(response: WeixinGetUploadUrlResponse): WeixinGetUploadUrlResponse {
  const nested = response.data
  if (!nested) return response
  return {
    ret: response.ret ?? nested.ret,
    errcode: response.errcode ?? nested.errcode,
    errmsg: response.errmsg ?? nested.errmsg,
    upload_param: response.upload_param ?? nested.upload_param,
    thumb_upload_param: response.thumb_upload_param ?? nested.thumb_upload_param,
    upload_full_url: response.upload_full_url ?? nested.upload_full_url
  }
}
