/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`

  const totalSeconds = ms / 1000
  if (totalSeconds < 60) {
    const digits = totalSeconds >= 10 ? 0 : 1
    return `${totalSeconds.toFixed(digits)}s`
  }

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  const digits = seconds >= 10 ? 0 : 1

  return `${minutes}m${seconds.toFixed(digits)}s`
}
