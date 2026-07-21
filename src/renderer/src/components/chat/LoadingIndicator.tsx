import { useRef, useEffect } from 'react'
import { TokenCounter } from './TokenCounter'

interface LoadingIndicatorProps {
  /** Current state of the request */
  state: 'sending' | 'waiting' | 'receiving'
  /** Input tokens (for sending/waiting states) */
  inputTokens?: number
  /** Output tokens (for receiving state) */
  outputTokens?: number
  /** Optional className for styling */
  className?: string
}

/**
 * Loading indicator showing request/response status with animated token counts
 * - sending: ↑ with input token count animation
 * - waiting: ↑ with static input token count
 * - receiving: ↓ with output token count animation (cumulative from previous value)
 */
export function LoadingIndicator({
  state,
  inputTokens = 0,
  outputTokens = 0,
  className = ''
}: LoadingIndicatorProps): React.JSX.Element {
  const previousOutputRef = useRef(0)
  const isReceiving = state === 'receiving'
  const arrow = isReceiving ? '↓' : '↑'
  const tokens = isReceiving ? outputTokens : inputTokens
  const startFrom = isReceiving ? previousOutputRef.current : 0
  const shouldAnimate = state === 'sending' || state === 'receiving'

  // Update previous output after animation completes
  useEffect(() => {
    if (isReceiving && outputTokens > previousOutputRef.current) {
      // Delay update to allow animation to complete
      const timer = setTimeout(() => {
        previousOutputRef.current = outputTokens
      }, 500)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [isReceiving, outputTokens])

  return (
    <div className={`flex items-center gap-1.5 text-xs ${className}`}>
      <span className="font-medium">{arrow}</span>
      <TokenCounter target={tokens} startFrom={startFrom} animate={shouldAnimate} duration={500} />
    </div>
  )
}
