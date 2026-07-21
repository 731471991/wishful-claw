export interface ImageGenerateRetryState {
  attempt: number
  maxAttempts: number
  reason?: string
}

export function resolveImageGenerateRetry(_error: string): ImageGenerateRetryState | null {
  return null
}
