/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

import type { LiveOutputAnimationStyle } from '@renderer/stores/settings-store'

export const LIVE_OUTPUT_ANIMATION_STYLES = ['agile', 'elegant'] as const

export function getLiveOutputShimmerClass(style: LiveOutputAnimationStyle | string): string {
  return `ai-live-shimmer-text ${
    style === 'elegant' ? 'ai-live-shimmer-text--elegant' : 'ai-live-shimmer-text--agile'
  }`
}

export function getLiveOutputCursorClass(style: LiveOutputAnimationStyle | string): string {
  return `ai-live-cursor ${style === 'elegant' ? 'ai-live-cursor--elegant' : 'ai-live-cursor--agile'}`
}

export function getLiveOutputSurfaceClass(style: LiveOutputAnimationStyle | string): string {
  return `ai-live-stream ${
    style === 'elegant' ? 'ai-live-stream--elegant' : 'ai-live-stream--agile'
  }`
}

export function getLiveOutputComponentClass(style: LiveOutputAnimationStyle | string): string {
  return `ai-live-component ${
    style === 'elegant' ? 'ai-live-component--elegant' : 'ai-live-component--agile'
  }`
}
