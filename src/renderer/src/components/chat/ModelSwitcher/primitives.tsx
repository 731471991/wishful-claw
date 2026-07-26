import { cn } from '@renderer/lib/utils'

/**
 * Generic UI primitives used by ModelSettingsPopover.
 * Extracted from ModelSwitcher.tsx for code splitting (AGENTS.md compliance).
 */

export function SettingSection({
  accent,
  title,
  children,
  className
}: {
  accent: string
  title: string
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section className={cn('space-y-2.5', className)}>
      <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <span className={cn('h-4 w-0.5 rounded-full', accent)} />
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}

export function PillToggle({
  enabled,
  onClick,
  label,
  description,
  compact = false,
  activeClassName = 'bg-violet-500 border-violet-500'
}: {
  enabled: boolean
  onClick: () => void
  label: string
  description?: string
  compact?: boolean
  activeClassName?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={compact ? label : undefined}
      className={cn(
        'flex items-center justify-between rounded-md text-xs transition-colors',
        compact ? 'min-w-0 flex-1 gap-1.5 px-2 py-2' : 'w-full gap-3 px-2.5 py-2',
        enabled ? 'bg-muted/50 text-foreground' : 'text-foreground/75 hover:bg-muted/45'
      )}
      onClick={onClick}
    >
      <span className="flex min-w-0 flex-col text-left">
        <span className={cn('font-medium', compact && 'truncate')}>{label}</span>
        {description && !compact && (
          <span className="text-[10px] text-muted-foreground">{description}</span>
        )}
      </span>
      <span
        className={cn(
          'shrink-0 rounded-full border-2 transition-colors',
          compact ? 'size-3.5' : 'ml-3 size-4',
          enabled ? activeClassName : 'border-muted-foreground/30'
        )}
      />
    </button>
  )
}
