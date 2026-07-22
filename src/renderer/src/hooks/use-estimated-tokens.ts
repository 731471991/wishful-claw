import { useState, useEffect, useMemo, useRef } from 'react'
import { estimateTokens } from '@renderer/lib/format-tokens'

/**
 * Hook that estimates token count for frequently changing text (e.g. user input).
 * Debounces the expensive tokenizer call to avoid blocking the UI on every keystroke.
 */
export function useDebouncedTokens(text: string, delay = 300): number {
  const [tokens, setTokens] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!text) {
      setTokens(0)
      return
    }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setTokens(estimateTokens(text))
    }, delay)
    return () => clearTimeout(timerRef.current)
  }, [text, delay])

  return tokens
}

/**
 * Hook that estimates token count for static/rarely-changing text (e.g. message content).
 * Uses useMemo to cache the result — only recalculates when text actually changes.
 */
export function useMemoizedTokens(text: string): number {
  return useMemo(() => (text ? estimateTokens(text) : 0), [text])
}
