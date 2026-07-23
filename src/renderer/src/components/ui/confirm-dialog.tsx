import * as React from 'react'

interface ConfirmOptions {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  confirmLabel?: string
  variant?: 'default' | 'destructive' | 'warning'
  onConfirm?: () => void | Promise<void>
  sessionId?: string
  imageEdit?: unknown
  status?: string
  maxToolCallsPerTurn?: number
  [key: string]: unknown
}

export async function confirm(_options: ConfirmOptions): Promise<boolean> {
  // TODO: implement with dialog UI
  return true
}
