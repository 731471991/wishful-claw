export interface ImageSize {
  width: number
  height: number
}

export interface MaskStroke {
  points: { x: number; y: number }[]
  color: string
  size: number
}

export function getRelativePoint(_e: { clientX: number; clientY: number }, _rect: DOMRect): { x: number; y: number } {
  return { x: 0, y: 0 }
}

export function drawMaskStroke(_ctx: CanvasRenderingContext2D, _stroke: MaskStroke): void {}

export function buildMaskDataUrl(_canvas: HTMLCanvasElement): string {
  return ''
}
