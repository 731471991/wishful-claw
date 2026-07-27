import { AnimatePresence, motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { cn } from '@renderer/lib/utils'

function formatRetryDelay(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

interface RetryBannerProps {
  sessionId: string | null
}

/**
 * Fixed-position retry banner shown above the composer.
 * Unlike the per-message retry indicator in action-bar.tsx,
 * this always renders at the bottom of the chat (above the input),
 * so the user always sees retry status without scrolling.
 *
 * No exit animation — when retry succeeds (text_delta arrives) the banner
 * disappears instantly. This avoids a "flash" where the banner fades out
 * (looking like success) and then fades back in (another 429) during
 * consecutive retry attempts.
 */
export function RetryBanner({ sessionId }: RetryBannerProps) {
  const { t } = useTranslation('chat')
  const animationsEnabled = useSettingsStore((s) => s.animationsEnabled)
  const retryState = useAgentStore((s) =>
    sessionId ? (s.sessionRequestRetryState[sessionId] ?? null) : null
  )

  if (!retryState) return null

  return (
    <motion.div
      key="retry-banner"
      initial={animationsEnabled ? { opacity: 0, y: 4 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={animationsEnabled ? { duration: 0.15, ease: 'easeOut' } : { duration: 0 }}
      className={cn(
        'mx-1 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/8',
        'px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300'
      )}
    >
      <RotateCcw className="mt-0.5 size-3.5 shrink-0 animate-spin" />
      <div className="min-w-0">
        <div className="font-medium">
          {t('assistantMessage.retryingRequest', { defaultValue: 'Request retrying' })}
        </div>
        <div className="mt-0.5 break-words text-[11px] text-amber-700/80 dark:text-amber-200/80">
          {t('assistantMessage.retryingRequestDetail', {
            defaultValue:
              'Attempt {{attempt}} / {{maxAttempts}} retry, resend after {{delay}}{{statusSuffix}}',
            attempt: retryState.attempt,
            maxAttempts: retryState.maxAttempts,
            delay: formatRetryDelay(retryState.delayMs),
            statusSuffix: retryState.statusCode
              ? `, status code ${retryState.statusCode}`
              : ''
          })}
          {retryState.reason ? ` · ${retryState.reason}` : ''}
        </div>
      </div>
    </motion.div>
  )
}
