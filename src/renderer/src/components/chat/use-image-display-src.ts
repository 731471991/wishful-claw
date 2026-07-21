import { useEffect, useState } from 'react'
import { filePathToMediaUrl } from '@renderer/lib/local-media-url'

export interface ImageDimensions {
  width: number
  height: number
}

const imageDimensionCache = new Map<string, ImageDimensions>()

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function isDataUrl(value: string): boolean {
  return value.startsWith('data:')
}

function isFileUrl(value: string): boolean {
  return /^file:\/\//i.test(value)
}

function fileUrlToFilePath(fileUrl: string): string {
  try {
    const parsed = new URL(fileUrl)
    if (parsed.protocol !== 'file:') return ''

    const decodedPath = decodeURIComponent(parsed.pathname)
    if (parsed.hostname) {
      return `//${parsed.hostname}${decodedPath}`
    }
    return decodedPath.replace(/^\/([A-Za-z]:\/)/, '$1')
  } catch {
    return ''
  }
}

export function buildImageDimensionCacheKey(src: string, filePath?: string): string {
  return filePath?.trim() ? `file:${filePath}` : `src:${src}`
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) throw new Error('Invalid data URL')

  const metadata = dataUrl.slice(5, commaIndex)
  const data = dataUrl.slice(commaIndex + 1)
  const mimeType = metadata.split(';')[0] || 'application/octet-stream'

  if (metadata.includes(';base64')) {
    const binary = window.atob(data)
    const bytes = new Uint8Array(binary.length)

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    return new Blob([bytes], { type: mimeType })
  }

  return new Blob([decodeURIComponent(data)], { type: mimeType })
}

export function filePathToFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const withLeadingSlash =
    /^[A-Za-z]:\//.test(normalized) || normalized.startsWith('/')
      ? `/${normalized.replace(/^\/+/, '')}`
      : `/${normalized}`
  return encodeURI(`file://${withLeadingSlash}`)
}

export function getCachedImageDimensions(
  src: string,
  filePath?: string,
  displaySrc?: string
): ImageDimensions | null {
  const sourceDimensions = imageDimensionCache.get(buildImageDimensionCacheKey(src, filePath))
  if (sourceDimensions) return sourceDimensions
  return displaySrc ? (imageDimensionCache.get(`display:${displaySrc}`) ?? null) : null
}

export function cacheImageDimensions(
  src: string,
  dimensions: ImageDimensions,
  options?: {
    filePath?: string
    displaySrc?: string
  }
): ImageDimensions {
  imageDimensionCache.set(buildImageDimensionCacheKey(src, options?.filePath), dimensions)
  if (options?.displaySrc) {
    imageDimensionCache.set(`display:${options.displaySrc}`, dimensions)
  }
  return dimensions
}

export function useImageDisplaySrc(src?: string, filePath?: string): string {
  const rawSrc = src ?? ''
  const sourceKey = buildImageDimensionCacheKey(rawSrc, filePath)
  const directSrc = (() => {
    if (rawSrc.startsWith('blob:') || isDataUrl(rawSrc)) return rawSrc
    // Local files are streamed via the oc-media protocol — no size limit,
    // unlike the old fs:read-file-binary base64 path.
    const localPath = filePath?.trim() || (isFileUrl(rawSrc) ? fileUrlToFilePath(rawSrc) : '')
    if (localPath) return filePathToMediaUrl(localPath)
    if (rawSrc && !isHttpUrl(rawSrc)) return rawSrc
    return ''
  })()
  const fallbackSrc = isHttpUrl(rawSrc) ? rawSrc : ''
  const [displayState, setDisplayState] = useState<{ key: string; src: string }>({
    key: '',
    src: ''
  })
  const displaySrc = displayState.key === sourceKey ? displayState.src : ''

  useEffect(() => {
    if (directSrc || !rawSrc || !isHttpUrl(rawSrc)) {
      return undefined
    }

    let cancelled = false

    void window.api
      .fetchImageBase64({ url: rawSrc })
      .then((result) => {
        if (cancelled) return
        if (result.data) {
          setDisplayState({
            key: sourceKey,
            src: `data:${result.mimeType || 'image/png'};base64,${result.data}`
          })
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [directSrc, rawSrc, sourceKey])

  return directSrc || displaySrc || fallbackSrc
}
