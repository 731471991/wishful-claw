import type { LiveOutputAnimationStyle } from '@renderer/stores/settings-store'

export const LIVE_OUTPUT_ANIMATION_STYLES = ['agile', 'elegant'] as const

export function getLiveOutputShimmerClass(style: LiveOutputAnimationStyle): string {
  return `ai-live-shimmer-text ${
    style === 'elegant' ? 'ai-live-shimmer-text--elegant' : 'ai-live-shimmer-text--agile'
  }`
}

export function getLiveOutputCursorClass(style: LiveOutputAnimationStyle): string {
  return `ai-live-cursor ${style === 'elegant' ? 'ai-live-cursor--elegant' : 'ai-live-cursor--agile'}`
}

export function getLiveOutputSurfaceClass(style: LiveOutputAnimationStyle): string {
  return `ai-live-stream ${
    style === 'elegant' ? 'ai-live-stream--elegant' : 'ai-live-stream--agile'
  }`
}

export function getLiveOutputComponentClass(style: LiveOutputAnimationStyle): string {
  return `ai-live-component ${
    style === 'elegant' ? 'ai-live-component--elegant' : 'ai-live-component--agile'
  }`
}
