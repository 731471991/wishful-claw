import * as React from 'react'
import type { AppMode } from '@renderer/stores/ui-store'
import type { ImageAttachment } from '@renderer/lib/image-attachments'

interface UsePromptRecommendationParams {
  mode: AppMode
  sessionId?: string | null
  text: string
  getRecentMessages: () => unknown[]
  selectedSkill: string | null
  images: ImageAttachment[]
  disabled: boolean
  isStreaming: boolean
  fallbackSuggestion: string
  getCaretAtEnd?: () => boolean
}

interface UsePromptRecommendationResult {
  suggestionText: string
  measureText: string
  effectivePlaceholder?: string
  canAcceptSuggestion: boolean
  acceptSuggestion: () => string | null
  cancelPendingRequest: () => void
  handleFocus: () => void
  handleBlur: () => void
  handleSelectionChange: () => void
  handleCompositionStart: () => void
  handleCompositionEnd: () => void
}

/**
 * Stub implementation of usePromptRecommendation.
 * Prompt recommendation feature is not yet implemented in wishful-claw.
 * Returns no-op functions so InputArea can render without errors.
 */
export function usePromptRecommendation(
  _params: UsePromptRecommendationParams
): UsePromptRecommendationResult {
  return {
    suggestionText: '',
    measureText: '',
    effectivePlaceholder: undefined,
    canAcceptSuggestion: false,
    acceptSuggestion: React.useCallback(() => null, []),
    cancelPendingRequest: React.useCallback(() => {}, []),
    handleFocus: React.useCallback(() => {}, []),
    handleBlur: React.useCallback(() => {}, []),
    handleSelectionChange: React.useCallback(() => {}, []),
    handleCompositionStart: React.useCallback(() => {}, []),
    handleCompositionEnd: React.useCallback(() => {}, [])
  }
}
