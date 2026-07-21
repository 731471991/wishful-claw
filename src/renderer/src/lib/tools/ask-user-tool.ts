export interface AskUserQuestionItem {
  question: string
  options: { label: string; description?: string }[]
  multiSelect?: boolean
}

export interface AskUserAnnotation {
  header?: string
  questions: AskUserQuestionItem[]
}

export type AskUserAnswers = Record<string, string | string[]>
export type AskUserResolvedPayload = { questions: unknown[]; answers: unknown }
export type AskUserStructuredResult = { annotation: AskUserAnnotation; resolved: AskUserResolvedPayload | null }

export function coerceAskUserQuestions(_input: unknown): AskUserAnnotation | null {
  return null
}

export function resolveAskUserAnswers(_annotation: AskUserAnnotation, _raw: unknown): AskUserResolvedPayload {
  return { questions: [], answers: {} }
}
