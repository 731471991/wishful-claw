import type { AggregatedFileChange } from '@renderer/components/chat/file-change-utils'

export function isErrorResult(value: unknown): value is { error: string } {
  return !!value && typeof value === 'object' && 'error' in value && typeof value.error === 'string'
}

export function statusLabelKey(
  change: AggregatedFileChange
): 'fileChange.status.reverted' | 'fileChange.status.pending' {
  if (change.status === 'reverted') return 'fileChange.status.reverted'
  return 'fileChange.status.pending'
}

export function statusTone(change: AggregatedFileChange): string {
  if (change.status === 'reverted') return 'text-muted-foreground dark:text-zinc-300'
  return 'text-sky-600 dark:text-sky-300'
}

export function actionLabel(change: AggregatedFileChange): string {
  return change.op === 'create' ? 'fileChange.new' : 'fileChange.edited'
}
