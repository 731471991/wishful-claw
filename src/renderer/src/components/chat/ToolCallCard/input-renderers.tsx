import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import { MONO_FONT } from '@renderer/lib/constants'
import { LazySyntaxHighlighter } from '../LazySyntaxHighlighter'
import { CopyBtn } from './shared'
import { lineCount } from './utils'

// ── EditPayloadPane ──

export function EditPayloadPane({
  label,
  value,
  language,
  tone = 'default',
  truncated
}: {
  label: string
  value: string
  language?: string
  tone?: 'default' | 'old' | 'new'
  truncated?: boolean
}): React.JSX.Element {
  const borderTone =
    tone === 'old'
      ? 'border-red-500/20'
      : tone === 'new'
        ? 'border-green-500/20'
        : 'border-border/60'
  const headerTone =
    tone === 'old'
      ? 'text-red-400/80'
      : tone === 'new'
        ? 'text-green-400/80'
        : 'text-muted-foreground/60'
  const { t } = useTranslation('chat')

  return (
    <div className={cn('rounded-md border bg-muted/20 dark:bg-zinc-950/70', borderTone)}>
      <div className="flex items-center gap-1.5 border-b border-border/50 px-2.5 py-1.5 text-[10px] uppercase tracking-wide">
        <span className={headerTone}>{label}</span>
        <span className="text-muted-foreground/55">
          {t('toolCall.lineCount', { count: lineCount(value) })}
        </span>
        <span className="text-muted-foreground/55">
          {t('toolCall.charCount', { count: value.length })}
        </span>
        {truncated && (
          <span className="rounded bg-muted px-1 py-0.5 text-[9px] normal-case text-muted-foreground/60">
            {t('toolCall.preview')}
          </span>
        )}
        <CopyBtn text={value} />
      </div>
      <LazySyntaxHighlighter
        language={language}
        showLineNumbers
        customStyle={{
          margin: 0,
          padding: '0.5rem',
          borderRadius: 0,
          fontSize: '11px',
          maxHeight: '12rem',
          overflow: 'auto',
          fontFamily: MONO_FONT
        }}
        codeTagProps={{ style: { fontFamily: 'inherit' } }}
      >
        {value}
      </LazySyntaxHighlighter>
    </div>
  )
}

// ── StructuredInput ──


export { StructuredInput } from './structured-input'
