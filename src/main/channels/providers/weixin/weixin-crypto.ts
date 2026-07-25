import { createCipheriv, createDecipheriv } from 'crypto'
import { DEFAULT_WEIXIN_CDN_BASE_URL } from './weixin-types'

export function parseAesKey(aesKeyBase64: string): Buffer {
  const decoded = Buffer.from(aesKeyBase64, 'base64')
  if (decoded.length === 16) {
    return decoded
  }

  const ascii = decoded.toString('ascii')
  if (decoded.length === 32 && /^[0-9a-fA-F]{32}$/.test(ascii)) {
    return Buffer.from(ascii, 'hex')
  }

  throw new Error(`Invalid Weixin media aes_key format: decoded ${decoded.length} bytes`)
}

export function decryptAesEcb(buffer: Buffer, key: Buffer): Buffer {
  const decipher = createDecipheriv('aes-128-ecb', key, null)
  return Buffer.concat([decipher.update(buffer), decipher.final()])
}

export function encryptAesEcb(buffer: Buffer, key: Buffer): Buffer {
  const cipher = createCipheriv('aes-128-ecb', key, null)
  return Buffer.concat([cipher.update(buffer), cipher.final()])
}

export function aesEcbPaddedSize(plaintextSize: number): number {
  return Math.ceil((plaintextSize + 1) / 16) * 16
}

export function sniffImageMediaType(buffer: Buffer): string | undefined {
  if (buffer.length < 12) {
    return undefined
  }

  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif'
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return 'image/bmp'
  }

  return undefined
}

export function detectImageMediaType(buffer: Buffer, fallback?: string): string {
  const normalizedFallback = (fallback || '').split(';', 1)[0].trim().toLowerCase()
  if (
    normalizedFallback &&
    normalizedFallback !== 'application/octet-stream' &&
    normalizedFallback !== 'binary/octet-stream'
  ) {
    return normalizedFallback
  }

  return sniffImageMediaType(buffer) || normalizedFallback || 'image/png'
}

export function normalizeCdnBaseUrl(baseUrl: string): string {
  return (baseUrl || DEFAULT_WEIXIN_CDN_BASE_URL).replace(/\/+$/, '')
}

export function buildCdnDownloadUrl(cdnBaseUrl: string, encryptedQueryParam: string): string {
  return `${normalizeCdnBaseUrl(cdnBaseUrl)}/download?encrypted_query_param=${encodeURIComponent(encryptedQueryParam)}`
}

export function buildCdnUploadUrl(cdnBaseUrl: string, uploadParam: string, fileKey: string): string {
  return `${normalizeCdnBaseUrl(cdnBaseUrl)}/upload?encrypted_query_param=${encodeURIComponent(uploadParam)}&filekey=${encodeURIComponent(fileKey)}`
}

export function encodeOutboundMediaAesKey(aesKeyHex: string): string {
  return Buffer.from(aesKeyHex, 'utf8').toString('base64')
}
