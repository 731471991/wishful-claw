import * as React from 'react'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Sparkles,
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { coerceAskUserQuestions, resolveAskUserAnswers } from '@renderer/lib/tools/ask-user-tool'
import type {
  AskUserQuestionItem,
  AskUserResolvedPayload,
} from '@renderer/lib/tools/ask-user-tool'
import type { ToolCallStatus } from '@renderer/lib/agent/types'
import type { ToolResultContent } from '@renderer/lib/api/types'
import { isStructuredToolErrorText } from '@renderer/lib/tools/tool-result-format'
import { decodeStructuredToolResult } from '@renderer/lib/tools/tool-result-format'
import {
  outputAsText,
  parseAnsweredPairs,
  isRedundantSummary,
  buildRecommendedPayload,
  buildSubmissionPayload,
  questionHasAnswer,
  type AnsweredPair,
} from './ask-user-utils'
import { QuestionBlock, PreviewPane } from './ask-user-question-block'
import { AskUserView } from './ask-user-views'

export function AskUserQuestionCard({
  toolUseId,
  input,
  output,
  status,
  isLive
}: AskUserQuestionCardProps): React.JSX.Element {
  const { t } = useTranslation('chat')
  const questions = React.useMemo(() => coerceAskUserQuestions(input.questions), [input.questions])
  const clarifyAutoAcceptRecommended = useSettingsStore((s) => s.clarifyAutoAcceptRecommended)
  const parsedAnswers = React.useMemo(() => parseAnsweredPairs(output), [output])
  const answeredPairs = parsedAnswers.pairs
  const answeredStructured = parsedAnswers.structured
  const answeredText = React.useMemo(() => outputAsText(output), [output])
  const outputErrorMessage = React.useMemo(() => {
    const text = outputAsText(output)
    if (!text || !isStructuredToolErrorText(text)) return null
    const parsed = decodeStructuredToolResult(text)
    if (!parsed || Array.isArray(parsed) || typeof parsed.error !== 'string') return null
    return parsed.error
  }, [output])
  const isError = status === 'error' || !!outputErrorMessage
  const isCanceled = status === 'canceled'
  const isAnswered = status === 'completed' && answeredPairs.length > 0
  // AskUserQuestion is special: the agent stream ends while waiting for user input,
  // so status may fall back to 'canceled' or 'completed' even though the question
  // is still pending. The true signal for answered is having parsed answer pairs.
  // If there are no answers, no error, and no output text, the question is still open.
  const isPending = !isAnswered && !isError && !isCanceled && !answeredText &&
    (status === 'running' || isLive || status === 'completed' || status === 'canceled')
  const isCompletedWithoutAnswers =
    status === 'completed' && !isAnswered && !isError && !isCanceled && !!answeredText

  const [selections, setSelections] = useState<Map<number, Set<string>>>(() => new Map())
  const [customTexts, setCustomTexts] = useState<Map<number, string>>(() => new Map())
  const [notesByQuestion, setNotesByQuestion] = useState<Map<number, string>>(() => new Map())
  const [hoveredOptions, setHoveredOptions] = useState<Map<number, string | null>>(() => new Map())
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const autoSubmittedRef = React.useRef(false)

  const recommendedPayload = React.useMemo(() => buildRecommendedPayload(questions), [questions])

  React.useEffect(() => {
    autoSubmittedRef.current = false
    setSelections(new Map())
    setCustomTexts(new Map())
    setNotesByQuestion(new Map())
    setHoveredOptions(new Map())
    setCurrentQuestionIndex(0)
  }, [toolUseId])

  React.useEffect(() => {
    if (autoSubmittedRef.current) return
    if (!isPending || isAnswered) return
    if (!clarifyAutoAcceptRecommended) return
    if (!recommendedPayload) return

    autoSubmittedRef.current = true
    setSelections(recommendedPayload.selections)
    setCurrentQuestionIndex(Math.max(questions.length - 1, 0))
    resolveAskUserAnswers(toolUseId, recommendedPayload.payload)
  }, [
    clarifyAutoAcceptRecommended,
    isAnswered,
    isPending,
    questions.length,
    recommendedPayload,
    toolUseId
  ])

  const handleToggle = useCallback(
    (qIdx: number, value: string) => {
      if (value === '__other__') {
        setHoveredOptions((prev) => {
          const next = new Map(prev)
          next.delete(qIdx)
          return next
        })
      }

      setSelections((prev) => {
        const next = new Map(prev)
        const current = new Set(next.get(qIdx) ?? [])
        const q = questions[qIdx]
        if (value === '__other__') {
          if (current.has('__other__')) {
            current.delete('__other__')
          } else {
            if (!q?.multiSelect) current.clear()
            current.add('__other__')
          }
        } else if (current.has(value)) {
          current.delete(value)
        } else {
          if (!q?.multiSelect) {
            current.clear()
          }
          current.add(value)
          if (!q?.multiSelect) current.delete('__other__')
        }
        next.set(qIdx, current)
        return next
      })
    },
    [questions]
  )

  const handleCustomTextChange = useCallback((qIdx: number, text: string) => {
    setCustomTexts((prev) => {
      const next = new Map(prev)
      next.set(qIdx, text)
      return next
    })
  }, [])

  const handleNotesChange = useCallback((qIdx: number, text: string) => {
    setNotesByQuestion((prev) => {
      const next = new Map(prev)
      next.set(qIdx, text)
      return next
    })
  }, [])

  const handleHoverOption = useCallback((qIdx: number, value: string | null) => {
    setHoveredOptions((prev) => {
      const next = new Map(prev)
      if (value === null) {
        next.delete(qIdx)
      } else {
        next.set(qIdx, value)
      }
      return next
    })
  }, [])

  const handleSubmit = useCallback(() => {
    resolveAskUserAnswers(
      toolUseId,
      buildSubmissionPayload(questions, selections, customTexts, notesByQuestion)
    )
  }, [toolUseId, questions, selections, customTexts, notesByQuestion])

  const hasCurrentAnswer = React.useMemo(() => {
    const sel = selections.get(currentQuestionIndex) ?? new Set()
    const custom = customTexts.get(currentQuestionIndex) ?? ''
    return questionHasAnswer(questions[currentQuestionIndex], sel, custom)
  }, [currentQuestionIndex, questions, selections, customTexts])

  const hasAllAnswers = React.useMemo(() => {
    for (let i = 0; i < questions.length; i += 1) {
      const sel = selections.get(i) ?? new Set()
      const custom = customTexts.get(i) ?? ''
      if (!questionHasAnswer(questions[i], sel, custom)) return false
    }
    return true
  }, [questions, selections, customTexts])

  const isLastQuestion = currentQuestionIndex === questions.length - 1
  const isFirstQuestion = currentQuestionIndex === 0

  React.useEffect(() => {
    if (!isPending) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.isComposing) return
      const target = event.target
      if (target instanceof HTMLElement) {
        const tagName = target.tagName.toLowerCase()
        const editable = target.getAttribute('contenteditable')
        if (tagName === 'textarea' || tagName === 'input' || editable === 'true') return
      }

      if (event.key === 'ArrowLeft' && questions.length > 1 && !isFirstQuestion) {
        event.preventDefault()
        setCurrentQuestionIndex((value) => Math.max(0, value - 1))
        return
      }

      if (
        event.key === 'ArrowRight' &&
        questions.length > 1 &&
        !isLastQuestion &&
        hasCurrentAnswer
      ) {
        event.preventDefault()
        setCurrentQuestionIndex((value) => Math.min(questions.length - 1, value + 1))
        return
      }

      if (event.key === 'Enter' && !event.shiftKey && isLastQuestion && hasAllAnswers) {
        event.preventDefault()
        handleSubmit()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    handleSubmit,
    hasAllAnswers,
    hasCurrentAnswer,
    isFirstQuestion,
    isLastQuestion,
    isPending,
    questions.length
  ])

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }, [currentQuestionIndex, questions.length])

  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }, [currentQuestionIndex])

  if (isError || isCanceled || isAnswered || isCompletedWithoutAnswers) {
    return (
      <AskUserView
        isCanceled={isCanceled}
        isError={isError}
        isAnswered={isAnswered}
        isCompletedWithoutAnswers={isCompletedWithoutAnswers}
        outputErrorMessage={outputErrorMessage}
        answeredText={answeredText}
        answeredPairs={answeredPairs}
        answeredStructured={answeredStructured}
      />
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  if (!currentQuestion) return <></>

  return (
    <div className="my-2.5 rounded-lg border border-border/70 bg-background/70 p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full border border-border/60 bg-muted/40">
          <MessageSquare className="size-3.5 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground">{t('askUser.title')}</div>
          <div className="text-[11px] text-muted-foreground">{t('askUser.subtitle')}</div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80">
          {questions.length > 1 && (
            <span className="font-mono text-xs">
              {currentQuestionIndex + 1}/{questions.length}
            </span>
          )}
          {isPending && (
            <span className="flex items-center gap-1 text-primary/80">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              {t('askUser.waiting')}
            </span>
          )}
        </div>
      </div>

      {questions.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {questions.map((question, index) => {
            const isActive = index === currentQuestionIndex
            const isDone = (() => {
              const sel = selections.get(index) ?? new Set()
              const custom = customTexts.get(index) ?? ''
              return questionHasAnswer(question, sel, custom)
            })()

            return (
              <button
                key={`${question.header ?? question.question}-${index}`}
                type="button"
                onClick={() => setCurrentQuestionIndex(index)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : isDone
                      ? 'border-border/70 bg-muted/30 text-foreground'
                      : 'border-border/70 bg-background/60 text-muted-foreground hover:bg-muted/30'
                )}
              >
                {isDone ? (
                  <Check className="size-3" />
                ) : (
                  <span className="size-3 rounded-full border" />
                )}
                <span>{question.header || `${index + 1}`}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-3">
        <QuestionBlock
          index={currentQuestionIndex}
          item={currentQuestion}
          selected={selections.get(currentQuestionIndex) ?? new Set()}
          customText={customTexts.get(currentQuestionIndex) ?? ''}
          notes={notesByQuestion.get(currentQuestionIndex) ?? ''}
          hoveredOption={hoveredOptions.get(currentQuestionIndex) ?? null}
          onToggle={handleToggle}
          onCustomTextChange={handleCustomTextChange}
          onNotesChange={handleNotesChange}
          onHoverOption={handleHoverOption}
          disabled={!isPending}
        />
      </div>

      {isPending && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-border/50 pt-3">
          {questions.length > 1 && !isFirstQuestion && (
            <Button
              onClick={handlePrevious}
              variant="outline"
              size="xs"
              className="gap-1 text-[12px]"
            >
              <ChevronLeft className="size-3.5" />
              {t('askUser.previous')}
            </Button>
          )}

          <div className="flex-1" />

          {questions.length > 1 && !isLastQuestion && (
            <Button
              onClick={handleNext}
              disabled={!hasCurrentAnswer}
              size="xs"
              className="gap-1 text-[12px]"
            >
              {t('askUser.next')}
              <ChevronRight className="size-3.5" />
            </Button>
          )}

          {isLastQuestion && (
            <Button
              onClick={handleSubmit}
              disabled={!hasAllAnswers}
              size="xs"
              className="gap-1 text-[12px]"
            >
              {t('askUser.submit')}
              <ChevronRight className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
