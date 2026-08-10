import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { Target, Loader2, Play, Trash2 } from 'lucide-react'
import { useGoalStore } from '@renderer/stores/goal-store'
import { resolveGoalConfirm, cancelGoalConfirm } from '@renderer/lib/tools/goal-native-ui'

interface GoalConfirmCardProps {
  sessionId?: string | null
  className?: string
}

export function GoalConfirmCard({ sessionId, className }: GoalConfirmCardProps): React.JSX.Element | null {
  const { t } = useTranslation('chat')
  const progress = useGoalStore((s) => (sessionId ? s.goalProgressBySession[sessionId] : undefined))
  const [confirming, setConfirming] = React.useState(false)
  const [clearing, setClearing] = React.useState(false)

  if (!sessionId || !progress) return null

  const goalId = progress.goalId
  const objective = progress.objective ?? ''

  const handleConfirm = async (): Promise<void> => {
    setConfirming(true)
    resolveGoalConfirm(goalId, true, sessionId)
  }

  const handleDiscard = async (): Promise<void> => {
    setClearing(true)
    cancelGoalConfirm(goalId)
  }

  return (
    <div className={cn('rounded-2xl border border-sky-500/30 bg-sky-500/5 px-4 py-3 shadow-sm backdrop-blur', className)}>
      <div className="flex items-start gap-2">
        <Target className="mt-0.5 size-4 shrink-0 text-sky-500" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground/90">
            {t('goal.pendingConfirmTitle', { defaultValue: 'Confirm this goal before execution' })}
          </div>
          <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
            {objective}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-destructive"
            disabled={clearing}
            onClick={handleDiscard}
          >
            {clearing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            {t('goal.discard', { defaultValue: 'Discard' })}
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 bg-sky-600 text-white hover:bg-sky-700"
            disabled={confirming}
            onClick={handleConfirm}
          >
            {confirming ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            {t('goal.confirmRun', { defaultValue: 'Confirm & start' })}
          </Button>
        </div>
      </div>
    </div>
  )
}