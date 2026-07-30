// Quota indicator components extracted from ModelSwitcher.tsx

import { MonitorSmartphone } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'

export interface CodexQuotaData {
  primary?: { usedPercent?: number; resetAt?: string } | null
  secondary?: { usedPercent?: number; resetAt?: string } | null
}

export interface CopilotQuotaData {
  sku?: string | null
  chatEnabled?: boolean
  tokenExpiresAt?: string | null
}

export function formatPercent(value?: number): string {
  if (value === undefined || Number.isNaN(value)) return '0%'
  return `${Math.round(value)}%`
}

export function formatResetAt(value?: string): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (['invalid date', 'null', 'undefined', 'nan'].includes(trimmed.toLowerCase())) return ''

  const tryParse = (input: string | number): Date | null => {
    const candidate = new Date(input)
    return Number.isNaN(candidate.getTime()) ? null : candidate
  }

  let parsed: Date | null = null

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const numericValue = Number(trimmed)
    if (Number.isFinite(numericValue)) {
      const timestamp = numericValue < 1e12 ? numericValue * 1000 : numericValue
      parsed = tryParse(timestamp)
    }
  }

  if (!parsed) {
    const normalized = trimmed
      .replace(/\[(?:[^\]]+)\]$/, '')
      .replace(
        /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)$/,
        '$1T$2'
      )
      .replace(/(\.\d{3})\d+(?=(?:Z|[+-]\d{2}:?\d{2})$)/i, '$1')
      .replace(/ UTC$/i, 'Z')
    parsed = tryParse(trimmed) ?? (normalized !== trimmed ? tryParse(normalized) : null)
  }

  if (!parsed) return ''
  return parsed.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function CodexQuotaIndicator({ quota, tSettings }: { quota: CodexQuotaData; tSettings: (key: string) => string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 border border-border/10 cursor-help hover:bg-muted/50 transition-colors mx-1">
          <MonitorSmartphone className="size-3 text-emerald-500" />
          <div className="flex flex-col leading-none gap-0.5">
            <div className="h-1 w-10 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, quota.primary?.usedPercent ?? 0)}%` }} />
            </div>
            <span className="text-[9px] text-muted-foreground/60 font-medium">{formatPercent(quota.primary?.usedPercent)}</span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="p-3 w-48 space-y-2">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{tSettings('provider.codexQuotaPrimary')}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">{formatPercent(quota.primary?.usedPercent)}</span>
            <span className="text-[10px] text-muted-foreground">{formatResetAt(quota.primary?.resetAt)}</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, quota.primary?.usedPercent ?? 0)}%` }} />
          </div>
        </div>
        {quota.secondary && (
          <div className="space-y-1 pt-1 border-t">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{tSettings('provider.codexQuotaSecondary')}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">{formatPercent(quota.secondary.usedPercent)}</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, quota.secondary.usedPercent ?? 0)}%` }} />
            </div>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

export function CopilotQuotaIndicator({ quota, tSettings }: { quota: CopilotQuotaData; tSettings: (key: string) => string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 border border-border/10 cursor-help hover:bg-muted/50 transition-colors mx-1">
          <MonitorSmartphone className="size-3 text-sky-500" />
          <div className="flex flex-col leading-none gap-0.5">
            <span className="text-[9px] text-muted-foreground/70 font-medium">{quota.sku || 'copilot'}</span>
            <span className="text-[9px] text-muted-foreground/50">
              {quota.chatEnabled ? tSettings('provider.copilotChatEnabled') : tSettings('provider.copilotChatDisabled')}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="p-3 w-56 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{tSettings('provider.copilotQuotaSku')}</span>
          <span className="text-xs font-bold">{quota.sku || '-'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{tSettings('provider.copilotQuotaChat')}</span>
          <span className="text-xs font-bold">
            {quota.chatEnabled ? tSettings('provider.copilotChatEnabled') : tSettings('provider.copilotChatDisabled')}
          </span>
        </div>
        {quota.tokenExpiresAt && (
          <div className="flex items-center justify-between gap-2 border-t pt-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{tSettings('provider.copilotQuotaTokenExpires')}</span>
            <span className="text-[10px] text-muted-foreground">
              {new Date(quota.tokenExpiresAt).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
