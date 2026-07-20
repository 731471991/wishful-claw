import { Monitor, MoonStar, SunMedium } from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  APP_THEME_PRESETS,
  resolveAppThemeMode,
  type AppThemeMode,
  type AppThemePreset,
  type ThemePresetDefinition
} from '@renderer/lib/theme-presets'
import { cn } from '@renderer/lib/utils'
import { useSettingsStore, type ThemeMode } from '@renderer/stores/settings-store'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'

const MODE_OPTIONS: Array<{ value: ThemeMode; icon: typeof SunMedium; label: string }> = [
  { value: 'light', icon: SunMedium, label: '浅色' },
  { value: 'dark', icon: MoonStar, label: '深色' },
  { value: 'system', icon: Monitor, label: '跟随系统' }
]

const FONT_OPTIONS = [
  { label: '系统默认', value: '__default__' },
  { label: 'Inter', value: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { label: 'Segoe UI', value: "'Segoe UI', system-ui, -apple-system, sans-serif" },
  { label: 'Noto Sans', value: "'Noto Sans', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif" },
  { label: 'Source Sans 3', value: "'Source Sans 3', system-ui, sans-serif" },
  { label: 'Monospace', value: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace" }
]

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

function PresetCard({
  preset,
  active,
  mode,
  onClick
}: {
  preset: ThemePresetDefinition
  active: boolean
  mode: AppThemeMode
  onClick: () => void
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
          <div className="truncate text-sm font-semibold text-foreground">{preset.label}</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{preset.description}</p>
        </div>
        {active && (
          <span className="shrink-0 rounded-full bg-primary px-2 py-1 text-[0.65rem] font-semibold text-primary-foreground">
            当前
          </span>
        )}
      </div>

      <PresetPreview preset={preset} mode={mode} />

      <div className="mt-3 flex items-center justify-between gap-3">
        <PresetSwatches preset={preset} />
        <span className="text-[0.66rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          全局
        </span>
      </div>
    </button>
  )
}

export function GeneralPanel(): React.JSX.Element {
  const settings = useSettingsStore()
  const { resolvedTheme } = useTheme()
  const resolvedMode = resolveAppThemeMode(
    settings.theme === 'system' ? resolvedTheme : settings.theme
  )

  const clampFontSize = (value: number): number => Math.min(20, Math.max(12, value))

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-8 pb-16 pt-10">
      {/* Title */}
      <div>
        <h2 className="text-lg font-semibold">通用</h2>
        <p className="text-sm text-muted-foreground">主题、外观和偏好设置</p>
      </div>

      {/* Theme mode */}
      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-foreground">主题模式</div>
          <p className="text-xs text-muted-foreground">选择浅色或深色主题，或跟随系统设置</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MODE_OPTIONS.map((option) => {
            const active = settings.theme === option.value
            const Icon = option.icon
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => settings.updateSettings({ theme: option.value })}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-[16px] border px-3 py-3 text-sm transition-all',
                  active
                    ? 'border-primary bg-primary text-primary-foreground shadow-[0_16px_32px_-24px_color-mix(in_srgb,var(--primary)_75%,transparent)]'
                    : 'border-border bg-card text-foreground hover:border-foreground/15 hover:bg-accent'
                )}
              >
                <Icon className="size-4" />
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Theme preset */}
      <section className="space-y-3">
        <div>
          <div className="text-sm font-medium text-foreground">配色方案</div>
          <p className="text-xs text-muted-foreground">选择全局配色预设，影响所有界面元素</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {APP_THEME_PRESETS.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              active={settings.themePreset === preset.id}
              mode={resolvedMode}
              onClick={() => settings.updateSettings({ themePreset: preset.id as AppThemePreset })}
            />
          ))}
        </div>
      </section>

      {/* Appearance */}
      <section className="space-y-4">
        <div>
          <label className="text-sm font-medium">外观</label>
          <p className="text-xs text-muted-foreground">字体和界面尺寸</p>
        </div>

        {/* Font family */}
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium">字体</label>
            <p className="text-xs text-muted-foreground">界面显示字体</p>
          </div>
          <Select
            value={settings.fontFamily || '__default__'}
            onValueChange={(value) =>
              settings.updateSettings({ fontFamily: value === '__default__' ? '' : value })
            }
          >
            <SelectTrigger className="w-80 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((option) => (
                <SelectItem key={option.label} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Font size */}
        <div className="space-y-2">
          <div className="flex items-center justify-between max-w-lg">
            <div>
              <label className="text-xs font-medium">字号</label>
              <p className="text-xs text-muted-foreground">界面字体大小 (px)</p>
            </div>
            <span className="text-xs text-muted-foreground">{settings.fontSize}px</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={12}
              max={20}
              step={1}
              value={settings.fontSize}
              onChange={(e) => settings.updateSettings({ fontSize: clampFontSize(parseInt(e.target.value)) })}
              className="flex-1 max-w-lg accent-primary"
            />
            <Input
              type="number"
              min={12}
              max={20}
              value={settings.fontSize}
              onChange={(e) => {
                const next = clampFontSize(parseInt(e.target.value, 10) || 14)
                settings.updateSettings({ fontSize: next })
              }}
              className="max-w-24 text-xs"
            />
          </div>
        </div>

        {/* Background color */}
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium">背景颜色</label>
            <p className="text-xs text-muted-foreground">自定义应用背景色，留空使用默认</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="color"
              value={settings.backgroundColor || '#111111'}
              onChange={(e) => settings.updateSettings({ backgroundColor: e.target.value })}
              className="h-8 w-12 cursor-pointer p-1"
            />
            <Input
              type="text"
              value={settings.backgroundColor}
              onChange={(e) => settings.updateSettings({ backgroundColor: e.target.value.trim() })}
              placeholder="留空使用默认"
              className="max-w-40 text-xs"
            />
            <button
              type="button"
              className="h-8 rounded-md border px-3 text-xs text-muted-foreground transition-colors hover:bg-accent"
              onClick={() => settings.updateSettings({ backgroundColor: '' })}
            >
              重置
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
