/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

import type { SubAgentResult } from './types'

export interface BackgroundSubAgentCompletion {
  sessionId: string
  toolUseId: string
  subAgentName: string
  displayName: string
  result: SubAgentResult
}

type BackgroundSubAgentCompletionListener = (event: BackgroundSubAgentCompletion) => void

class BackgroundSubAgentCompletionBus {
  private listeners = new Set<BackgroundSubAgentCompletionListener>()

  on(listener: BackgroundSubAgentCompletionListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(event: BackgroundSubAgentCompletion): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

export const backgroundSubAgentCompletions = new BackgroundSubAgentCompletionBus()
