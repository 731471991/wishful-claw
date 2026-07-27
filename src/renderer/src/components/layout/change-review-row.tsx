import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, Copy, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import type { AggregatedFileChange } from '@renderer/components/chat/file-change-utils'
import { statusLabelKey, statusTone, actionLabel } from './session-change-utils'
import {  AnimatePresence, motion } from 'motion/react'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useSettingsStore } from '@renderer/stores/settings-store'

export function ChangeRow({
  change,
  summary,
  expanded,
  onToggle
}: {
  change: AggregatedFileChange
  summary: DiffSummaryStats
  expanded: boolean
  onToggle: () => void
}): React.JSX.Element {
  const { t } = useTranslation(['chat', 'common'])
  const animationsEnabled = useSettingsStore((s) => s.animationsEnabled)
  const undoFileChange = useAgentStore((state) => state.undoFileChange)
  const [isUndoing, setIsUndoing] = React.useState(false)
  const actionableChanges = React.useMemo(() => actionableSourceChanges(change), [change])
  const actionable = actionableChanges.length > 0

  const handleUndo = async (): Promise<void> => {
    if (!actionable) return
    setIsUndoing(true)
    try {
      for (const entry of [...actionableChanges].sort((a, b) => b.createdAt - a.createdAt)) {
        await undoFileChange(entry.runId, entry.id)
      }
    } finally {
      setIsUndoing(false)
    }
  }

  const renderExpanded = (): React.JSX.Element => (
    <div className="border-t border-border/50 px-4 pb-4 pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
        <span className={cn(statusTone(change))}>{t(statusLabelKey(change))}</span>
        <span className="text-muted-foreground">
          {t(`fileChange.transport.${change.transport}`)}
        </span>
      </div>
      <ChangeDetail change={change} />
    </div>
  )

  return (
    <motion.div
      layout={animationsEnabled ? 'position' : false}
      initial={animationsEnabled ? { opacity: 0, y: -4 } : false}
      animate={animationsEnabled ? { opacity: 1, y: 0 } : undefined}
      exit={animationsEnabled ? { opacity: 0 } : undefined}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn(
        'overflow-hidden border-b border-border/50 transition-colors last:border-b-0',
        expanded ? 'bg-muted/30' : 'hover:bg-muted/20'
      )}
    >
      <div className="flex items-start gap-1.5 px-3 py-2.5">
        <button
          type="button"
          className="min-w-0 flex flex-1 items-start gap-2.5 text-left"
          onClick={onToggle}
          title={change.filePath}
          aria-expanded={expanded}
        >
          <ChevronDown
            className={cn(
              'mt-0.5 size-3.5 shrink-0 transition-transform duration-200',
              expanded ? 'rotate-180 text-foreground' : 'text-muted-foreground'
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">
                {t(actionLabel(change))}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                {fileName(change.filePath)}
              </span>
              <span className="shrink-0 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
                +{summary.added}
              </span>
              <span className="shrink-0 text-[10px] font-semibold text-red-600 dark:text-red-300">
                -{summary.deleted}
              </span>
            </div>
            <div
              className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-muted-foreground"
              style={{ fontFamily: MONO_FONT }}
            >
              {change.filePath}
            </div>
          </div>
        </button>

        {actionable ? (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => void handleUndo()}
            disabled={isUndoing}
            title={t('action.undo', { ns: 'common' })}
            aria-label={t('action.undo', { ns: 'common' })}
          >
            {isUndoing ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
          </Button>
        ) : (
          <RotateCcw className="mt-1 size-4 shrink-0 text-muted-foreground" />
        )}
      </div>

      {animationsEnabled ? (
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="diff"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {renderExpanded()}
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : expanded ? (
        renderExpanded()
      ) : null}
    </motion.div>
  )
}

