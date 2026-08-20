import * as React from 'react'
import type { TFunction } from 'i18next'
import { toast } from 'sonner'
import { useUIStore } from '@renderer/stores/ui-store'

interface UseModeControlsOptions {
  projectScoped: boolean
  draftSessionId: string | null
  disabled: boolean
  isStreaming: boolean
  isOptimizingLocked: boolean
  pendingImageReads: number
  hasActiveGoal: boolean
  focusInputAtEnd: () => void
  setPendingPlanMode: React.Dispatch<React.SetStateAction<boolean>>
  setPendingGoalMode: React.Dispatch<React.SetStateAction<boolean>>
  t: TFunction
}

export function useModeControls(opts: UseModeControlsOptions) {
  const handlePlanModeChange = React.useCallback(
    (enabled: boolean): void => {
      if (enabled && !opts.projectScoped) {
        toast.error(
          opts.t('input.planModeUnavailable', {
            defaultValue: 'Plan Mode needs a project working folder.'
          })
        )
        return
      }

      if (opts.draftSessionId) {
        if (enabled) {
          useUIStore.getState().enterPlanMode(opts.draftSessionId)
        } else {
          useUIStore.getState().exitPlanMode(opts.draftSessionId)
        }
        return
      }

      opts.setPendingPlanMode(enabled)
    },
    [opts.draftSessionId, opts.projectScoped, opts.t, opts.setPendingPlanMode]
  )

  const handleGoalModeChange = React.useCallback(
    (enabled: boolean): void => {
      if (opts.disabled || opts.isStreaming || opts.isOptimizingLocked || opts.pendingImageReads > 0) return

      if (!enabled) {
        opts.setPendingGoalMode(false)
        return
      }

      if (opts.hasActiveGoal) return
      opts.setPendingGoalMode(true)
      requestAnimationFrame(() => {
        opts.focusInputAtEnd()
      })
    },
    [
      opts.disabled,
      opts.draftSessionId,
      opts.focusInputAtEnd,
      opts.hasActiveGoal,
      opts.isOptimizingLocked,
      opts.isStreaming,
      opts.pendingImageReads,
      opts.t,
      opts.setPendingGoalMode
    ]
  )

  return { handlePlanModeChange, handleGoalModeChange }
}
