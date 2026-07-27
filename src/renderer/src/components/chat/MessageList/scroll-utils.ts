/**
 * Utilities extracted from useMessageListScroll to keep it under 500 lines.
 */

import type React from 'react'
import { useChatStore } from '@renderer/stores/chat-store'
import {
  type AssistantReplyRailItem,
  ASSISTANT_RAIL_SCROLL_OFFSET,
  USER_LOCATOR_HIGHLIGHT_MS,
  areStringSetsEqual,
} from './utils'

/**
 * Scroll the list to a specific assistant message, loading more messages
 * from the database if the target is not currently resident.
 */
export function createJumpToAssistantMessage(params: {
  listRef: React.RefObject<HTMLDivElement | null>
  activeSessionId: string | null
  markProgrammaticScroll: () => void
  requestAssistantRailSync: () => void
  rowVirtualizer: {
    scrollToIndex: (index: number, opts?: { align: string }) => void
  }
  setActiveAssistantRailIds: (ids: Set<string>) => void
  setHighlightedMessageId: React.Dispatch<React.SetStateAction<string | null>>
  highlightedMessageTimerRef: React.RefObject<number | null>
  autoScrollModeRef: React.RefObject<string>
  setIsAtBottom: React.Dispatch<React.SetStateAction<boolean>>
}): (item: AssistantReplyRailItem) => Promise<void> {
  const {
    listRef,
    activeSessionId,
    markProgrammaticScroll,
    requestAssistantRailSync,
    rowVirtualizer,
    setActiveAssistantRailIds,
    setHighlightedMessageId,
    highlightedMessageTimerRef,
    autoScrollModeRef,
    setIsAtBottom,
  } = params

  return async (item: AssistantReplyRailItem): Promise<void> => {
    const messageId = item.id
    autoScrollModeRef.current = 'off'
    setIsAtBottom(false)

    const setHighlightTimer = (): void => {
      setHighlightedMessageId(messageId)
      if (highlightedMessageTimerRef.current !== null) {
        window.clearTimeout(highlightedMessageTimerRef.current)
      }
      highlightedMessageTimerRef.current = window.setTimeout(() => {
        setHighlightedMessageId((prev) => (prev === messageId ? null : prev))
        highlightedMessageTimerRef.current = null
      }, USER_LOCATOR_HIGHLIGHT_MS)
    }

    const scrollToTarget = (behavior: ScrollBehavior = 'smooth'): boolean => {
      const ref = listRef.current
      if (!ref) return false
      const target = Array.from(ref.querySelectorAll<HTMLElement>('[data-message-id]')).find(
        (element) => element.dataset.messageId === messageId
      )
      if (!target) return false
      markProgrammaticScroll()
      setActiveAssistantRailIds(new Set([messageId]))
      setHighlightTimer()
      const targetTop =
        ref.scrollTop + (target.getBoundingClientRect().top - ref.getBoundingClientRect().top)
      ref.scrollTo({ top: Math.max(0, targetTop - ASSISTANT_RAIL_SCROLL_OFFSET), behavior })
      requestAssistantRailSync()
      return true
    }

    if (scrollToTarget()) return
    if (!activeSessionId) return

    await useChatStore
      .getState()
      .loadMessageWindowAround?.(activeSessionId, { messageId, sortOrder: item.sortOrder }, 30)

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve())
      })
    })

    if (scrollToTarget()) return

    const chatState = useChatStore.getState()
    const targetIndex = chatState
      .getSessionMessages(activeSessionId)
      .findIndex((message) => message.id === messageId)
    if (targetIndex >= 0) {
      const targetSession = chatState.sessions.find((session) => session.id === activeSessionId)
      rowVirtualizer.scrollToIndex(
        targetIndex + ((targetSession?.loadedRangeStart ?? 0) > 0 ? 1 : 0),
        { align: 'center' }
      )
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve())
      })
      scrollToTarget('auto')
    }
  }
}

/**
 * Set a prompt text into the active textarea or contenteditable editor.
 * Unrelated to scroll logic — kept here to avoid polluting the main hook.
 */
export function applySuggestedPrompt(prompt: string): void {
  const textarea = document.querySelector('textarea')
  if (textarea instanceof window.HTMLTextAreaElement) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set
    nativeInputValueSetter?.call(textarea, prompt)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.focus()
    return
  }
  const editor = document.querySelector('[role="textbox"][contenteditable="true"]')
  if (editor instanceof HTMLDivElement) {
    editor.replaceChildren(document.createTextNode(prompt))
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    editor.focus()
  }
}
