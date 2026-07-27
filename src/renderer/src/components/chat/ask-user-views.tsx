/**
 * Error, answered, and completed view components for AskUserQuestionCard.
 * Extracted from AskUserQuestionCard.tsx per AGENTS.md file splitting guidelines.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  CheckCircle2,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Badge } from '@renderer/components/ui/badge'
import { PreviewPane } from './ask-user-question-block'
import {
  isRedundantSummary,
  type AnsweredPair,
} from './ask-user-utils'
import type { AskUserStructuredResult } from '@renderer/lib/tools/ask-user-tool'

export interface AskUserViewProps {
  isCanceled: boolean
  outputErrorMessage: string | null
  answeredText: string | null
  answeredPairs: AnsweredPair[]
  answeredStructured: AskUserStructuredResult | null
  isError: boolean
  isAnswered: boolean
  isCompletedWithoutAnswers: boolean
}

export function AskUserView(props: AskUserViewProps): React.JSX.Element | null {
  const { isCanceled, isError, isAnswered, isCompletedWithoutAnswers } = props

  if (isError || isCanceled) {
    return <ErrorView {...props} />
  }

  if (isAnswered) {
    return <AnsweredView {...props} />
  }

  if (isCompletedWithoutAnswers) {
    return <CompletedView {...props} />
  }

  return null
}

export function ErrorView({
  isCanceled,
  outputErrorMessage,
  answeredText
}: AskUserViewProps): React.JSX.Element {
  const { t } = useTranslation('chat')
  const title = isCanceled ? t('askUser.canceledTitle') : t('askUser.errorTitle')
  const subtitle = isCanceled ? t('askUser.canceledSubtitle') : t('askUser.errorSubtitle')

  return (
    <div
      className={cn(
        'my-2.5 rounded-lg p-4 shadow-sm',
        isCanceled
          ? 'border border-border/70 bg-muted/20'
          : 'border border-destructive/40 bg-destructive/5'
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-full border',
            isCanceled
              ? 'border-border/60 bg-background/70'
              : 'border-destructive/30 bg-destructive/10'
          )}
        >
          <MessageSquare
            className={cn('size-3.5', isCanceled ? 'text-muted-foreground' : 'text-destructive')}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div>{title}</div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>

      {(outputErrorMessage ?? answeredText) && (
        <div
          className={cn(
            'mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap',
            isCanceled
              ? 'border-border/60 bg-background/60 text-muted-foreground'
              : 'border-destructive/30 bg-background/60 text-muted-foreground'
          )}
        >
          {outputErrorMessage ?? answeredText}
        </div>
      )}
    </div>
  )
}

export function AnsweredView({
  answeredPairs,
  answeredStructured
}: AskUserViewProps): React.JSX.Element {
  const { t } = useTranslation('chat')

  return (
    <div className="my-2.5 rounded-lg border border-border/70 bg-background/70 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span className="flex size-7 items-center justify-center rounded-full border border-border/60 bg-muted/40">
          <CheckCircle2 className="size-3.5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span>{t('askUser.answeredTitle')}</span>
            {answeredStructured?.autoAnswered && (
              <Badge variant="outline" className="text-[10px] text-primary">
                <Sparkles className="size-3" />
                {t('askUser.autoAnswered')}
              </Badge>
            )}
            {answeredStructured?.source && (
              <Badge variant="secondary" className="text-[10px]">
                {t('askUser.sourceLabel')}: {answeredStructured.source}
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">{t('askUser.answeredSubtitle')}</div>
        </div>
      </div>

      {answeredStructured?.summary &&
        !isRedundantSummary(answeredStructured.summary, answeredPairs) && (
          <div className="mt-3 rounded-xl border border-border/60 bg-muted/15 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
            {answeredStructured.summary}
          </div>
        )}

      <div className="mt-3 space-y-2.5">
        {answeredPairs.map((pair, index) => (
          <div
            key={`${pair.question}-${index}`}
            className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3"
          >
            <div className="flex items-start gap-2 text-xs leading-5">
              <span className="mt-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Q
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-foreground/90">{pair.question}</div>
              </div>
            </div>
            <div className="mt-1.5 flex items-start gap-2 text-xs leading-5">
              <span className="mt-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                A
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="whitespace-pre-wrap break-words text-muted-foreground">
                  {pair.answer}
                </div>
                {pair.annotation?.notes && (
                  <div className="rounded-lg border border-border/50 bg-background/70 px-2.5 py-2 text-[11px] text-muted-foreground">
                    <div className="mb-1 font-medium text-foreground/80">
                      {t('askUser.notesTitle')}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{pair.annotation.notes}</div>
                  </div>
                )}
                {pair.annotation?.preview && (
                  <div className="rounded-lg border border-border/50 bg-background/70 p-2.5">
                    <PreviewPane preview={pair.annotation.preview} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CompletedView({
  answeredText
}: AskUserViewProps): React.JSX.Element {
  const { t } = useTranslation('chat')

  return (
    <div className="my-2.5 rounded-lg border border-border/70 bg-background/70 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <span className="flex size-7 items-center justify-center rounded-full border border-border/60 bg-muted/40">
          <MessageSquare className="size-3.5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div>{t('askUser.completedTitle')}</div>
          <div className="text-[11px] text-muted-foreground">
            {t('askUser.completedSubtitle')}
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {answeredText}
      </div>
    </div>
  )
}
