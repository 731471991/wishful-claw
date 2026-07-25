import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import type { ChangeRow } from './agent-files-types'
import { dirname, rowOpLabel, rowOpTone } from './agent-files-utils'

export function AgentFilesEmptyState({
  title,
  description
}: {
  title: string
  description: string
}): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-xs text-agent-files-muted">
      <FileCode className="size-8 opacity-45" />
      <div className="text-sm font-medium text-agent-files-fg">{title}</div>
      <div className="max-w-64 leading-5">{description}</div>
    </div>
  )
}

export function ChangeItemRow({
  row,
  selected,
  onSelect,
  onDiscard,
  onUndo,
  showActions = true
}: {
  row: ChangeRow
  selected: boolean
  onSelect: () => void
  onDiscard?: () => void
  onUndo?: () => void
  showActions?: boolean
}): React.JSX.Element {
  const { t } = useTranslation('layout')
  const directory = dirname(row.filePath)
  const canShowAction = showActions && (row.source === 'agent' ? onUndo : onDiscard)
  return (
    <div
      className={cn(
        'agent-files-change-row group flex h-6 cursor-pointer items-center gap-1 px-2 text-[12px]',
        selected && 'agent-files-change-row--selected'
      )}
      title={row.filePath}
      onClick={onSelect}
    >
      <File className="size-3.5 shrink-0 text-agent-files-icon" />
      <span className="min-w-0 flex-1 truncate">{fileName(row.filePath)}</span>
      {directory ? (
        <span className="max-w-[72px] truncate text-[11px] text-agent-files-muted">
          {directory}
        </span>
      ) : null}
      <span className={cn('w-4 shrink-0 text-center font-mono text-[11px]', rowOpTone(row))}>
        {rowOpLabel(row)}
      </span>
      <span className="shrink-0 font-mono text-[11px] text-agent-files-added">+{row.added}</span>
      <span className="shrink-0 font-mono text-[11px] text-agent-files-deleted">
        -{row.deleted}
      </span>
      {canShowAction ? (
        <button
          type="button"
          className="agent-files-row-action ml-0.5 hidden size-5 items-center justify-center group-hover:inline-flex"
          onClick={(event) => {
            event.stopPropagation()
            row.source === 'agent' ? onUndo?.() : onDiscard?.()
          }}
          title={
            row.source === 'agent'
              ? t('agentFiles.undoAgentChange', { defaultValue: 'Undo agent change' })
              : t('agentFiles.discardFile', { defaultValue: 'Discard file changes' })
          }
        >
          {row.source === 'agent' ? (
            <RotateCcw className="size-3" />
          ) : (
            <Trash2 className="size-3" />
          )}
        </button>
      ) : null}
    </div>
  )
}

