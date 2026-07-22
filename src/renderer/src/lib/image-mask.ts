/**
 * Brush-mask engine shared by the chat image editor and the draw canvas.
 * A mask is a PNG at the source image's native resolution where painted
 * (transparent) pixels mark the region to regenerate — matching the OpenAI
 * images/edits convention.
 */

export interface Point {
  x: number
  y: number
}

export interface MaskStroke {
  size: number
  points: Point[]
}

export interface ImageSize {
  width: number
  height: number
}

const MASK_EXPORT_COLOR = 'rgba(0, 0, 0, 1)'

export function drawMaskStroke(
  ctx: CanvasRenderingContext2D,
  stroke: MaskStroke,
  color: string
): void {
  if (!stroke.points.length || stroke.size <= 0) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = stroke.size
  ctx.strokeStyle = color
  ctx.fillStyle = color

  if (stroke.points.length === 1) {
    const point = stroke.points[0]
    ctx.beginPath()
    ctx.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  ctx.beginPath()
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
  for (let index = 1; index < stroke.points.length; index += 1) {
    const point = stroke.points[index]
    ctx.lineTo(point.x, point.y)
  }
  ctx.stroke()
  ctx.restore()
}

/** White base with painted strokes punched to transparent (= edit region). */
export function buildMaskDataUrl(imageSize: ImageSize, strokes: MaskStroke[]): string {
  const canvas = document.createElement('canvas')
  canvas.width = imageSize.width
  canvas.height = imageSize.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = 'rgba(255, 255, 255, 1)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'destination-out'
  for (const stroke of strokes) {
    drawMaskStroke(ctx, stroke, MASK_EXPORT_COLOR)
  }
  ctx.globalCompositeOperation = 'source-over'

  return canvas.toDataURL('image/png')
}

export interface OutpaintExtend {
  left: number
  right: number
  top: number
  bottom: number
}

export interface OutpaintResult {
  baseDataUrl: string
  maskDataUrl: string
  size: ImageSize
}

/**
 * Composite the source onto a larger transparent canvas and build a mask whose
 * original-image region stays opaque (kept) while the new border is transparent
 * (regenerated) — the edit-path shape for outpainting. Extents are in source px.
 */
export function buildOutpaintCompositeAndMask(
  image: HTMLImageElement,
  extend: OutpaintExtend
): OutpaintResult | null {
  const srcW = image.naturalWidth
  const srcH = image.naturalHeight
  if (!srcW || !srcH) return null

  const left = Math.max(0, Math.round(extend.left))
  const right = Math.max(0, Math.round(extend.right))
  const top = Math.max(0, Math.round(extend.top))
  const bottom = Math.max(0, Math.round(extend.bottom))
  const width = srcW + left + right
  const height = srcH + top + bottom
  if (width <= srcW && height <= srcH) return null

  const base = document.createElement('canvas')
  base.width = width
  base.height = height
  const bctx = base.getContext('2d')
  if (!bctx) return null
  bctx.clearRect(0, 0, width, height)
  bctx.drawImage(image, left, top, srcW, srcH)

  const mask = document.createElement('canvas')
  mask.width = width
  mask.height = height
  const mctx = mask.getContext('2d')
  if (!mctx) return null
  mctx.clearRect(0, 0, width, height)
  mctx.fillStyle = 'rgba(255, 255, 255, 1)'
  mctx.fillRect(left, top, srcW, srcH)

  return {
    baseDataUrl: base.toDataURL('image/png'),
    maskDataUrl: mask.toDataURL('image/png'),
    size: { width, height }
  }
}

/** Map a pointer event over a canvas to source-native pixel coordinates. */
export function getRelativePoint(
  event: { clientX: number; clientY: number; currentTarget: HTMLElement },
  imageSize: ImageSize
): Point | null {
  const bounds = event.currentTarget.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return null

  const relativeX = (event.clientX - bounds.left) / bounds.width
  const relativeY = (event.clientY - bounds.top) / bounds.height

  return {
    x: Math.max(0, Math.min(imageSize.width, relativeX * imageSize.width)),
    y: Math.max(0, Math.min(imageSize.height, relativeY * imageSize.height))
  }
}
