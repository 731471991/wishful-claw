import { motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { cn } from '@renderer/lib/utils'

interface RetryBannerProps {
  sessionId: string | null
}

/**
 * Fixed-position retry banner shown above the composer.
 *
 * Key design: the banner element is always mounted as long as retryState
 * exists. When retryState changes (e.g. attempt 1→2), React reconciles
 * the same DOM node — only the text updates, no remount, no animation
 * replay. When retryState becomes null (retry succeeded or failed), the
 * element is removed from the DOM instantly (no exit animation, no
 * "flash" that looks like false success).
 *
 * The enter animation only plays on the very first mount (first 429),
 * not on subsequent retry attempts within the same retry sequence.
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
      className={cn(
        'mx-1 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/8',
        'px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300'
      )}
      initial={animationsEnabled ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={animationsEnabled ? { duration: 0.15, ease: 'easeOut' } : { duration: 0 }}
    >
      <RotateCcw className="mt-0.5 size-3.5 shrink-0 animate-spin" />
      <div className="min-w-0">
        <div className="font-medium">
          {t('assistantMessage.retryingRequest', { defaultValue: 'Request retrying' })}
        </div>
        <div className="mt-0.5 break-words text-[11px] text-amber-700/80 dark:text-amber-200/80">
          {t('assistantMessage.retryingRequestDetail', {
            defaultValue:
              'Attempt {{attempt}} / {{maxAttempts}}',
            attempt: retryState.attempt,
            maxAttempts: retryState.maxAttempts
          })}
        </div>
      </div>
    </motion.div>
  )
}
