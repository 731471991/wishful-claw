// process-summary.ts — generate a human-readable summary of the execution process
// for display in the collapsed ExecutionProcessBlock header.
//
// Example output: "运行了3个命令，查看了2个文件，编辑了1个文件"

import type { ToolExecutionOutline, ToolExecutionItem } from '../execution-outline'
import type { TFunction } from 'i18next'

interface CategoryCount {
  commands: number
  reads: number
  edits: number
}

function classifyItem(item: ToolExecutionItem): keyof CategoryCount | null {
  switch (item.category) {
    case 'command':
      return 'commands'
    case 'context':
      return 'reads'
    case 'file-change':
      return 'edits'
    default:
      return null
  }
}

/**
 * Generate a compact summary string from the tool execution outline.
 * Only counts commands, reads, and edits — other tool types are omitted
 * to keep the summary concise and meaningful.
 */
export function buildProcessSummary(
  outline: ToolExecutionOutline | null,
  _thinkingBlockCount: number,
  t: TFunction
): string | null {
  if (!outline) return null

  const visibleItems = outline.items.filter((item) => item.visibility !== 'hidden')
  if (visibleItems.length === 0) return null

  const counts: CategoryCount = { commands: 0, reads: 0, edits: 0 }
  for (const item of visibleItems) {
    const key = classifyItem(item)
    if (key) counts[key] += 1
  }

  const parts: string[] = []

  if (counts.commands > 0) {
    parts.push(
      t('workbench.summaryCommands', {
        count: counts.commands,
        defaultValue: `运行了${counts.commands}个命令`,
      })
    )
  }

  if (counts.reads > 0) {
    parts.push(
      t('workbench.summaryReads', {
        count: counts.reads,
        defaultValue: `查看了${counts.reads}个文件`,
      })
    )
  }

  if (counts.edits > 0) {
    parts.push(
      t('workbench.summaryEdits', {
        count: counts.edits,
        defaultValue: `编辑了${counts.edits}个文件`,
      })
    )
  }

  return parts.length > 0 ? parts.join('，') : null
}
