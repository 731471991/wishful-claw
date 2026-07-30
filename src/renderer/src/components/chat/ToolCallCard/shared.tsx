import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { ToolCallCardProps, SearchOutputMeta, SearchVisualState } from './types'

// ── CopyBtn ──

export function CopyBtn({ text, title }: { text: string; title?: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
      title={title ?? 'Copy'}
    >
      {copied ? <Check className="size-3 text-green-500" /> : <Copy className="size-3" />}
    </button>
  )
}

// ── McpToolIcon ──

export function McpToolIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-3.5 text-white/90"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M7.2 15.8 10.8 12.2" />
      <path d="M8.8 17.4 12.4 13.8" />
      <path d="M10.4 10.8 13.2 8" />
      <path d="M13.8 14.2 16.6 11.4" />
      <path d="M9.8 11.2 12.8 14.2 15.2 11.8 12.2 8.8Z" fill="currentColor" stroke="none" />
      <path
        d="M7.2 15.8c-.6.6-.6 1.6 0 2.2s1.6.6 2.2 0l.6-.6-2.2-2.2Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

// ── ToolDetailSectionHeader ──

export function ToolDetailSectionHeader({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-border/45 pb-2 pt-0.5 text-[12px] font-semibold text-foreground/88 dark:border-white/[0.08]">
      <span>{label}</span>
    </div>
  )
}

// ── InputField ──

export function InputField({
  label,
  value,
  mono,
  icon
}: {
  label: string
  value: string
  mono?: boolean
  icon?: React.ReactNode
}): React.JSX.Element | null {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <span className="shrink-0 text-muted-foreground/50 min-w-[70px] text-right select-none flex items-center justify-end gap-1">
        {icon}
        {label}
      </span>
      <span
        className={cn('break-all', mono && 'font-mono text-[11px]')}
        style={mono ? { fontFamily: 'var(--font-mono)' } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

// ── ToolStatusDot ──

export function ToolStatusDot({
  status
}: {
  status: ToolCallCardProps['status']
}): React.JSX.Element {
  switch (status) {
    case 'completed':
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="size-2.5 rounded-full bg-green-500" />
        </span>
      )
    case 'running':
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="absolute size-2.5 rounded-full bg-blue-500/30 animate-ping" />
          <span className="size-2.5 rounded-full bg-blue-500" />
        </span>
      )
    case 'error':
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="size-2.5 rounded-full bg-destructive" />
        </span>
      )
    case 'pending_approval':
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="absolute size-2.5 rounded-full bg-amber-500/30 animate-ping" />
          <span className="size-2.5 rounded-full bg-amber-500" />
        </span>
      )
    case 'streaming':
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="absolute size-2.5 rounded-full bg-violet-500/30 animate-ping" />
          <span className="size-2.5 rounded-full bg-violet-500" />
        </span>
      )
    default:
      return (
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          <span className="size-2.5 rounded-full border border-muted-foreground/30" />
        </span>
      )
  }
}

// ── HighlightText ──

export function HighlightText({ text, pattern }: { text: string; pattern?: string }): React.JSX.Element {
  if (!pattern) return <>{text}</>
  let parts: string[] | null = null
  try {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(${escaped})`, 'gi')
    parts = text.split(re)
  } catch {
    parts = null
  }
  if (!parts || parts.length <= 1) return <>{text}</>
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span
            key={i}
            className="rounded-sm bg-amber-200/70 px-px text-amber-900 dark:bg-amber-500/25 dark:text-amber-200"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

// ── Search UI helpers ──

export function SearchStateBadge({ state }: { state: SearchVisualState }): React.JSX.Element {
  const { t } = useTranslation('chat')
  const config =
    state === 'error'
      ? {
          label: t('toolCall.searchState.error'),
          className: 'border-destructive/30 bg-destructive/10 text-destructive'
        }
      : state === 'warning'
        ? {
            label: t('toolCall.searchState.warning'),
            className: 'border-amber-400/30 bg-amber-400/10 text-amber-500'
          }
        : state === 'found'
          ? {
              label: t('toolCall.searchState.found'),
              className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-500'
            }
          : {
              label: t('toolCall.searchState.noMatches'),
              className: 'border-muted-foreground/20 bg-muted/40 text-muted-foreground'
            }

  return (
    <span
      className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-medium', config.className)}
    >
      {config.label}
    </span>
  )
}

export function SearchEmptyState(): React.JSX.Element {
  const { t } = useTranslation('chat')
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
      {t('toolCall.searchState.noMatches')}
    </div>
  )
}

export function SearchMetaHint({ meta }: { meta: SearchOutputMeta }): React.JSX.Element | null {
  const { t } = useTranslation('chat')
  const notes = [
    meta.error,
    meta.truncated
      ? t('toolCall.searchState.truncated', {
          reason: meta.limitReason ? `: ${meta.limitReason}` : ''
        })
      : null,
    meta.timedOut ? t('toolCall.searchState.timedOut') : null,
    ...meta.warnings
  ].filter((item): item is string => typeof item === 'string' && item.length > 0)

  if (notes.length === 0) return null

  return (
    <div className="mt-1 text-[10px] text-amber-600/80 dark:text-amber-400/80">
      {notes.join(' · ')}
    </div>
  )
}
