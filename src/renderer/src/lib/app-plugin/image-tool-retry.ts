export interface ImageGenerateRetryState {
  attempt: number
  maxAttempts?: number
  reason?: string
  status?: string
  errorMessage?: string
  completedCount?: number
  totalCount?: number
}

export function resolveImageGenerateRetry(_error: string): ImageGenerateRetryState | null {
  return null
}
