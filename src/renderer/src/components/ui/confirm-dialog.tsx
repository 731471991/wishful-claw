import * as React from 'react'

interface ConfirmOptions {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
}

export async function confirm(_options: ConfirmOptions): Promise<boolean> {
  // TODO: implement with dialog UI
  return true
}
