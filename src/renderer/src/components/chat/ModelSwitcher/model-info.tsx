import { Eye, Wrench, Brain } from 'lucide-react'
import {
  modelSupportsVision
} from '@renderer/stores/provider-store'
import { cn } from '@renderer/lib/utils'
import type { AIModelConfig, AIProvider } from '@shared/types/provider'
import { formatContextLength, formatTokenCount, formatPrice } from './utils'

/**
 * Model capability tags and hover details display components.
 * Extracted from ModelSwitcher.tsx for code splitting (AGENTS.md compliance).
 */

export function ModelCapabilityTags({
  model,
  providerType,
  t,
  showContext = true
}: {
  model: AIModelConfig
  providerType?: AIProvider['type']
  t: (key: string) => string
  showContext?: boolean
}): React.JSX.Element {
  const ctx = formatContextLength(model.contextLength)
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {modelSupportsVision(model, providerType) && (
        <span className="inline-flex items-center gap-0.5 rounded-sm bg-emerald-500/10 px-1 py-px text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
          <Eye className="size-2.5" />
          {t('topbar.vision')}
        </span>
      )}
      {model.supportsFunctionCall && (
        <span className="inline-flex items-center gap-0.5 rounded-sm bg-blue-500/10 px-1 py-px text-[9px] font-medium text-blue-600 dark:text-blue-400">
          <Wrench className="size-2.5" />
          {t('topbar.tools')}
        </span>
      )}
      {model.supportsThinking && (
        <span className="inline-flex items-center gap-0.5 rounded-sm bg-violet-500/10 px-1 py-px text-[9px] font-medium text-violet-600 dark:text-violet-400">
          <Brain className="size-2.5" />
          {t('topbar.thinking')}
        </span>
      )}
      {showContext && ctx && (
        <span className="inline-flex items-center rounded-sm bg-muted/60 px-1 py-px text-[9px] font-medium text-muted-foreground">
          {ctx}
        </span>
      )}
    </div>
  )
}

export function ModelHoverDetails({
  model,
  tSettings
}: {
  model: AIModelConfig
  tSettings: (key: string, opts?: Record<string, unknown>) => string
}): React.JSX.Element | null {
  const contextRows = [
    {
      label: tSettings('provider.contextLength'),
      value: formatTokenCount(model.contextLength)
    },
    {
      label: tSettings('provider.maxOutputTokens'),
      value: formatTokenCount(model.maxOutputTokens)
    }
  ].filter((row) => row.value !== '-')

  const priceRows = [
    { label: tSettings('provider.inputPrice'), value: formatPrice(model.inputPrice) },
    { label: tSettings('provider.outputPrice'), value: formatPrice(model.outputPrice) },
    {
      label: tSettings('provider.cacheCreationPrice'),
      value: formatPrice(model.cacheCreationPrice)
    },
    { label: tSettings('provider.cacheHitPrice'), value: formatPrice(model.cacheHitPrice) }
  ].filter((row) => row.value !== '-')

  if (contextRows.length === 0 && priceRows.length === 0) return null

  return (
    <div className="mt-3 space-y-2 border-t border-border/60 pt-2">
      {contextRows.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {contextRows.map((row) => (
            <div key={row.label} className="min-w-0 rounded-md bg-muted/35 px-2 py-1.5">
              <div className="truncate text-[9px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {row.label}
              </div>
              <div className="mt-0.5 truncate text-[11px] font-semibold text-foreground/90">
                {row.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {priceRows.length > 0 && (
        <div className="space-y-1.5 rounded-md bg-muted/25 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2 text-[9px] font-medium uppercase tracking-wide text-muted-foreground/70">
            <span>{tSettings('provider.pricing')}</span>
            <span className="normal-case tracking-normal">{tSettings('provider.pricingUnit')}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {priceRows.map((row) => (
              <div key={row.label} className="flex min-w-0 items-center justify-between gap-2">
                <span className="truncate text-[10px] text-muted-foreground">{row.label}</span>
                <span className="shrink-0 text-[10px] font-semibold text-foreground/85">
                  {row.value.replace('/M tokens', '')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
