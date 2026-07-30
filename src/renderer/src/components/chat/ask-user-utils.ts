/**
 * Utility functions for AskUserQuestionCard.
 * Extracted from AskUserQuestionCard.tsx per AGENTS.md file splitting guidelines.
 */

import type { ToolResultContent } from '@renderer/lib/api/types'
import { decodeStructuredToolResult } from '@renderer/lib/tools/tool-result-format'
import type {
  AskUserQuestionItem,
  AskUserAnswers,
  AskUserAnnotation,
  AskUserResolvedPayload,
  AskUserStructuredResult
} from '@renderer/lib/tools/ask-user-tool'

export interface AnsweredPair {
  question: string
  answer: string
  annotation?: AskUserAnnotation
}


const RECOMMENDED_OPTION_RE = /(?:\(|（)\s*(recommended)\s*(?:\)|）)/i

export function getOptionLabel(label: string | undefined | null): string {
  return typeof label === 'string' ? label : ''
}

export function isRecommendedOptionLabel(label: string | undefined | null): boolean {
  return RECOMMENDED_OPTION_RE.test(getOptionLabel(label))
}

export function stripRecommendedMarker(label: string | undefined | null): string {
  return getOptionLabel(label).replace(RECOMMENDED_OPTION_RE, '').trim()
}

export function outputAsText(output: ToolResultContent | undefined): string | null {
  if (!output) return null
  const text =
    typeof output === 'string'
      ? output
      : output
          .filter((block) => block.type === 'text')
          .map((block) => (block.type === 'text' ? block.text : ''))
          .join('\n')
  return text || null
}

export function parseStructuredAnsweredResult(
  output: ToolResultContent | undefined
): AskUserStructuredResult | null {
  const text = outputAsText(output)
  if (!text) return null
  const parsed = decodeStructuredToolResult(text)
  if (!parsed || Array.isArray(parsed)) return null
  if (!parsed.answers || typeof parsed.answers !== 'object' || Array.isArray(parsed.answers))
    return null

  const answers = parsed.answers as Record<string, unknown>
  const normalizedAnswers: Record<string, string> = {}
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === 'string') {
      normalizedAnswers[key] = value
    }
  }

  const annotationsSource =
    parsed.annotations &&
    typeof parsed.annotations === 'object' &&
    !Array.isArray(parsed.annotations)
      ? Object.fromEntries(
          Object.entries(parsed.annotations as Record<string, unknown>)
            .map(([key, value]) => {
              if (!value || typeof value !== 'object' || Array.isArray(value)) return null
              const record = value as Record<string, unknown>
              const preview = typeof record.preview === 'string' ? record.preview : undefined
              const notes = typeof record.notes === 'string' ? record.notes : undefined
              if (!preview && !notes) return null
              return [key, { ...(preview ? { preview } : {}), ...(notes ? { notes } : {}) }]
            })
            .filter((entry): entry is [string, AskUserAnnotation] => entry !== null)
        )
      : undefined

  return {
    questions: Array.isArray(parsed.questions) ? (parsed.questions as AskUserQuestionItem[]) : [],
    answers: normalizedAnswers,
    summary:
      typeof parsed.summary === 'string' ? parsed.summary : 'User has answered your questions.',
    ...(annotationsSource ? { annotations: annotationsSource } : {}),
    ...(typeof parsed.source === 'string' && parsed.source.trim()
      ? { source: parsed.source.trim() }
      : {}),
    ...(parsed.autoAnswered === true ? { autoAnswered: true } : {})
  }
}

export function parseLegacyAnsweredPairs(output: ToolResultContent | undefined): AnsweredPair[] {
  const text = outputAsText(output)
  if (!text || !/^User answered:\s*/i.test(text)) return []

  const body = text.replace(/^User answered:\s*/i, '').trim()
  if (!body) return []

  const pairs: AnsweredPair[] = []
  const lines = body.split(/\r?\n/)
  let currentQuestion = ''
  let currentAnswerLines: string[] = []
  let collectingAnswer = false

  const flush = (): void => {
    const question = currentQuestion.trim()
    const answer = currentAnswerLines.join('\n').trim()
    if (question && answer) {
      pairs.push({ question, answer })
    }
    currentQuestion = ''
    currentAnswerLines = []
    collectingAnswer = false
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      if (collectingAnswer && currentAnswerLines.length > 0) {
        currentAnswerLines.push('')
      }
      continue
    }

    if (line.startsWith('Q: ')) {
      flush()
      currentQuestion = line.slice(3).trim()
      continue
    }

    if (line.startsWith('A: ')) {
      collectingAnswer = true
      currentAnswerLines = [line.slice(3).trim()]
      continue
    }

    if (collectingAnswer) {
      currentAnswerLines.push(line)
    } else if (currentQuestion) {
      currentQuestion = `${currentQuestion} ${line}`.trim()
    }
  }

  flush()
  return pairs
}

export function parseAnsweredPairs(output: ToolResultContent | undefined): {
  pairs: AnsweredPair[]
  structured: AskUserStructuredResult | null
} {
  const structured = parseStructuredAnsweredResult(output)
  if (structured) {
    const pairs = Object.entries(structured.answers).map(([question, answer]) => ({
      question,
      answer,
      annotation: structured.annotations?.[question]
    }))
    return { pairs, structured }
  }

  return {
    pairs: parseLegacyAnsweredPairs(output),
    structured: null
  }
}

export function isRedundantSummary(summary: string | undefined, pairs: AnsweredPair[]): boolean {
  const normalized = summary?.trim()
  if (!normalized) return true
  if (pairs.length === 0) return false

  return /^User has answered your questions(?::|\.)/i.test(normalized)
}

export function buildRecommendedPayload(
  questions: AskUserQuestionItem[]
): { payload: AskUserResolvedPayload; selections: Map<number, Set<string>> } | null {
  const answers: AskUserAnswers = {}
  const annotations: Record<string, AskUserAnnotation> = {}
  const selections = new Map<number, Set<string>>()

  for (let index = 0; index < questions.length; index += 1) {
    const item = questions[index]
    const recommended = (item.options ?? []).filter((opt) => isRecommendedOptionLabel(opt.label))

    if (recommended.length === 0) {
      return null
    }

    const chosen = item.multiSelect ? recommended : [recommended[0]]
    const labels = chosen.map((opt) => getOptionLabel(opt.label)).filter(Boolean)
    if (labels.length === 0) {
      return null
    }
    selections.set(index, new Set(labels))
    answers[String(index)] = item.multiSelect ? labels : labels[0]

    if (!item.multiSelect && chosen[0]?.preview) {
      annotations[String(index)] = { preview: chosen[0].preview }
    }
  }

  return {
    payload: {
      answers,
      ...(Object.keys(annotations).length > 0 ? { annotations } : {})
    },
    selections
  }
}



export function buildSubmissionPayload(
  questions: AskUserQuestionItem[],
  selections: Map<number, Set<string>>,
  customTexts: Map<number, string>,
  notesByQuestion: Map<number, string>
): AskUserResolvedPayload {
  const answers: AskUserAnswers = {}
  const annotations: Record<string, AskUserAnnotation> = {}

  for (let i = 0; i < questions.length; i += 1) {
    const sel = selections.get(i) ?? new Set()
    const custom = customTexts.get(i) ?? ''
    const notes = notesByQuestion.get(i)?.trim() ?? ''
    const q = questions[i]
    const picked = [...sel].filter((value) => value !== '__other__')

    if (sel.has('__other__') || !q.options || q.options.length === 0) {
      if (custom.trim()) {
        answers[String(i)] = q.multiSelect ? [...picked, custom.trim()] : custom.trim()
      } else if (picked.length > 0) {
        answers[String(i)] = q.multiSelect ? picked : picked[0]
      }
    } else if (picked.length > 0) {
      answers[String(i)] = q.multiSelect ? picked : picked[0]
    }

    if (!q.multiSelect && picked.length === 1) {
      const option = q.options?.find((candidate) => candidate.label === picked[0])
      if (option?.preview || notes) {
        annotations[String(i)] = {
          ...(option?.preview ? { preview: option.preview } : {}),
          ...(notes ? { notes } : {})
        }
      }
    } else if (notes) {
      annotations[String(i)] = { notes }
    }
  }

  return {
    answers,
    ...(Object.keys(annotations).length > 0 ? { annotations } : {})
  }
}

export function questionHasAnswer(
  question: AskUserQuestionItem | undefined,
  selected: Set<string>,
  customText: string
): boolean {
  if (!question) return false

  const pickedCount = [...selected].filter((value) => value !== '__other__').length
  if (pickedCount > 0) return true
  if (selected.has('__other__') && customText.trim()) return true
  return (!question.options || question.options.length === 0) && !!customText.trim()
}

