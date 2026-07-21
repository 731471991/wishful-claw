import type { OrchestrationStage } from '@renderer/lib/orchestration/types'
import { cn } from '@renderer/lib/utils'

export function OrchestrationStagePills({
  stages,
  compact = false
}: {
  stages: OrchestrationStage[]
  compact?: boolean
}): React.JSX.Element {
  return (
    <div className={cn('flex flex-wrap gap-1.5', compact && 'gap-1')}>
      {stages.map((stage, index) => (
        <div
          key={stage.id}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors',
            stage.status === 'completed' &&
              'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
            stage.status === 'active' && 'border-cyan-500/30 bg-cyan-500/12 text-cyan-300',
            stage.status === 'pending' &&
              'border-border/60 bg-background/70 text-muted-foreground/70',
            compact && 'px-1.5 py-0.5 text-[9px]'
          )}
        >
          <span className="tabular-nums opacity-70">{index + 1}</span>
          <span>{stage.label}</span>
        </div>
      ))}
    </div>
  )
}
