import type { AppThemeMode, ThemePresetDefinition } from '@renderer/lib/theme-presets'
import { cn } from '@renderer/lib/utils'

function PresetSwatches({ preset }: { preset: ThemePresetDefinition }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      {preset.swatches.map((color) => (
        <span
          key={color}
          className="size-4 rounded-full border border-black/10 shadow-sm dark:border-white/10"
          style={{ background: color }}
        />
      ))}
    </div>
  )
}

function PresetPreview({
  preset,
  mode
}: {
  preset: ThemePresetDefinition
  mode: AppThemeMode
}): React.JSX.Element {
  const preview = preset.preview[mode]
  return (
    <div
      className="mt-3 flex h-14 overflow-hidden rounded-xl border border-black/10 shadow-inner dark:border-white/10"
      style={{ background: preview.canvas }}
    >
      <div className="w-8 shrink-0" style={{ background: preview.rail }} />
      <div className="flex min-w-0 flex-1 items-center gap-2 p-2">
        <div className="h-8 w-10 rounded-lg" style={{ background: preview.card }} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="h-2.5 rounded-full" style={{ background: preview.accent }} />
          <div className="h-2 rounded-full" style={{ background: preview.accentSoft }} />
        </div>
      </div>
    </div>
  )
}

export function PresetCard({
  preset,
  active,
  mode,
  onClick,
  label,
  description,
  currentLabel,
  globalLabel
}: {
  preset: ThemePresetDefinition
  active: boolean
  mode: AppThemeMode
  onClick: () => void
  label: string
  description: string
  currentLabel: string
  globalLabel: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-h-[132px] flex-col rounded-[18px] border bg-card p-3 text-left transition-all hover:border-primary/35 hover:bg-accent/40',
        active
          ? 'border-primary shadow-[0_18px_38px_-28px_color-mix(in_srgb,var(--primary)_72%,transparent)]'
          : 'border-border'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{label}</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        {active && (
          <span className="shrink-0 rounded-full bg-primary px-2 py-1 text-[0.65rem] font-semibold text-primary-foreground">
            {currentLabel}
          </span>
        )}
      </div>

      <PresetPreview preset={preset} mode={mode} />

      <div className="mt-3 flex items-center justify-between gap-3">
        <PresetSwatches preset={preset} />
        <span className="text-[0.66rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {globalLabel}
        </span>
      </div>
    </button>
  )
}
