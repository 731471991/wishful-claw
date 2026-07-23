// Token usage summary display components

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ModelIcon } from '@renderer/components/settings/provider-icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import type { CompletionSummaryData } from './types'

function CompletionTokenSummary({
  summary
}: {
  summary: CompletionSummaryData
}): React.JSX.Element {
  const { t } = useTranslation('chat')
  const totalForSegments = summary.segments.reduce((sum, segment) => sum + segment.value, 0)
  const showDetails = summary.tokenRows.length > 0 || summary.metricRows.length > 0
  const triggerTitle = t('assistantMessage.tokenTotal', {
    defaultValue: 'Token total'
  })
  const trigger = (
    <button
      type="button"
      className="inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground/58 transition-colors hover:bg-muted/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50 dark:hover:bg-white/[0.045]"
      title={`${triggerTitle}: ${new Intl.NumberFormat().format(summary.totalTokens)}`}
    >
      {summary.estimated ? '~' : ''}
      {summary.totalValue}
    </button>
  )

  return (
    <div className="mt-1.5 flex justify-end">
      {!showDetails ? (
        trigger
      ) : (
        <HoverCard openDelay={120} closeDelay={120}>
          <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
          <HoverCardContent
            side="top"
            align="end"
            sideOffset={6}
            className="w-[280px] rounded-lg border-[#262626] bg-[#101010] p-3 text-zinc-100 shadow-2xl"
          >
            <div className="mb-3 flex min-w-0 items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#232323] ring-1 ring-white/8">
                <ModelIcon
                  icon={summary.modelIcon}
                  modelId={summary.modelId ?? undefined}
                  providerBuiltinId={summary.providerBuiltinId}
                  size={18}
                />
              </span>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium leading-4 text-zinc-100">
                  {summary.modelName ||
                    t('assistantMessage.tokenUsage', { defaultValue: 'Token usage' })}
                </div>
                {summary.providerName || summary.modelId ? (
                  <div className="truncate text-[10px] leading-3 text-zinc-500">
                    {summary.providerName ?? summary.modelId}
                  </div>
                ) : null}
              </div>
            </div>

            {totalForSegments > 0 ? (
              <div className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-zinc-700/85">
                {summary.segments.map((segment) => {
                  const width = Math.max(0, (segment.value / totalForSegments) * 100)
                  if (width <= 0) return null
                  return (
                    <span
                      key={segment.key}
                      className="h-full"
                      title={`${segment.label}: ${segment.value}`}
                      style={{ width: `${width}%`, backgroundColor: segment.color }}
                    />
                  )
                })}
              </div>
            ) : null}

            <div className="space-y-1">
              {summary.tokenRows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-4 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 text-zinc-400">
                    {row.color ? (
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                    ) : null}
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-zinc-100">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {summary.metricRows.length > 0 ? (
              <div className="mt-2 space-y-1 border-t border-white/9 pt-2">
                {summary.metricRows.map((row) => (
                  <div key={row.key} className="flex items-center justify-between gap-4 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 text-zinc-400">
                      <span className="truncate">{row.label}</span>
                      {row.hint ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CircleHelp
                              className="size-3 shrink-0 text-zinc-500"
                              aria-label={row.hint}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-center text-xs">
                            {row.hint}
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-zinc-100">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  )
}

export function CompletionSummaryBar({ summary }: { summary: CompletionSummaryData }): React.JSX.Element {
  return <CompletionTokenSummary summary={summary} />
}
