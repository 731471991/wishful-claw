// Small metric display components for runtime status

import * as React from 'react'
import { CircleHelp } from 'lucide-react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@renderer/components/ui/hover-card'
import { cn } from '@renderer/lib/utils'
import { TokenCounter } from '../TokenCounter'
import type { RuntimeMetricTone } from './types'
import { normalizeTokenCount } from './utils'
import type { ContextCompressionStatus } from './types'
import type { AIModelConfig } from '@shared/types/provider'
import type { UnifiedMessage, TokenUsage } from '@renderer/lib/api/types'

export function SmoothTokenNumber({
  value,
  animate = true,
  duration = 650
}: {
  value: number
  animate?: boolean
  duration?: number
}): React.JSX.Element {
  const safeValue = normalizeTokenCount(value)
  const previousValueRef = React.useRef(safeValue)
  const startFrom =
    animate && safeValue > previousValueRef.current ? previousValueRef.current : safeValue

  React.useEffect(() => {
    previousValueRef.current = safeValue
  }, [safeValue])

  return (
    <TokenCounter
      target={safeValue}
      startFrom={startFrom}
      duration={duration}
      animate={animate && safeValue !== startFrom}
    />
  )
}

export const metricToneClasses: Record<RuntimeMetricTone, string> = {
  input: 'text-sky-500/85 dark:text-sky-300/85',
  cacheHit: 'text-emerald-500/85 dark:text-emerald-300/85',
  cacheCreate: 'text-amber-500/90 dark:text-amber-300/90',
  output: 'text-violet-500/85 dark:text-violet-300/85',
  speed: 'text-cyan-500/85 dark:text-cyan-300/85',
  latency: 'text-rose-500/80 dark:text-rose-300/80'
}

export function MetricHoverTip({
  label,
  children
}: {
  label?: React.ReactNode
  children: React.ReactElement
}): React.JSX.Element {
  if (!label) return children
  return (
    <HoverCard openDelay={180} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={6}
        className="w-auto max-w-[260px] px-2.5 py-1.5 text-[11px] leading-snug"
      >
        {label}
      </HoverCardContent>
    </HoverCard>
  )
}

export function RuntimeMetric({
  label,
  value,
  tone,
  animate = true,
  duration = 600,
  suffix,
  title
}: {
  label: string
  value: number
  tone: RuntimeMetricTone
  animate?: boolean
  duration?: number
  suffix?: string
  title?: React.ReactNode
}): React.JSX.Element {
  const body = (
    <span className={cn('shrink-0', title && 'cursor-help')}>
      <span className="text-muted-foreground/60">{label}</span>{' '}
      <span className={cn('tabular-nums font-medium', metricToneClasses[tone])}>
        <SmoothTokenNumber value={value} animate={animate} duration={duration} />
      </span>
      {suffix && <span className="ml-0.5 tabular-nums text-muted-foreground/50">{suffix}</span>}
    </span>
  )
  return <MetricHoverTip label={title}>{body}</MetricHoverTip>
}

export function RuntimeTextMetric({
  label,
  value,
  tone,
  suffix,
  hint
}: {
  label: string
  value: string
  tone: RuntimeMetricTone
  suffix?: string
  hint?: string
}): React.JSX.Element {
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <span className="inline-flex items-center gap-1">
        <span className="text-muted-foreground/60">{label}</span>{' '}
        <span className={cn('tabular-nums font-medium', metricToneClasses[tone])}>{value}</span>
      </span>
      {suffix && <span className="ml-0.5 tabular-nums text-muted-foreground/50">{suffix}</span>}
      {hint ? (
        <MetricHoverTip label={hint}>
          <span className="inline-flex items-center">
            <CircleHelp
              className="size-3 shrink-0 cursor-help text-muted-foreground/50 hover:text-muted-foreground"
              aria-label={hint}
            />
          </span>
        </MetricHoverTip>
      ) : null}
    </span>
  )
}

interface ComposerRuntimeStatusProps {
  sessionId: string
  isStreaming: boolean
  draftInputTokens: number
  isOptimizing?: boolean
  pendingImageReads?: number
  contextCompressionStatus: ContextCompressionStatus
  contextCompressionStatusLabel: string
  model?: AIModelConfig | null
  className?: string
  messagesOverride?: readonly UnifiedMessage[]
  streamingMessageIdOverride?: string | null
  usageOverride?: TokenUsage
  showStatus?: boolean
}

