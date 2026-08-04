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
  searches: number
  other: number
  thinking: number
}

function classifyItem(item: ToolExecutionItem): keyof CategoryCount | null {
  switch (item.category) {
    case 'command':
      return 'commands'
    case 'context':
      return 'reads'
    case 'file-change':
      return 'edits'
    case 'attention':
    case 'interactive':
    case 'mcp':
    case 'orchestration':
    case 'skill':
    case 'visual':
    case 'browser':
    case 'desktop':
    case 'unknown':
      return 'other'
    case 'hidden':
      return null
    default:
      return null
  }
}

function countByCategory(items: ToolExecutionItem[]): CategoryCount {
  const counts: CategoryCount = {
    commands: 0,
    reads: 0,
    edits: 0,
    searches: 0,
    other: 0,
    thinking: 0,
  }
  for (const item of items) {
    const key = classifyItem(item)
    if (key) counts[key] += 1
  }
  return counts
}

/**
 * Generate a compact summary string from the tool execution outline.
 *
 * @param outline - The tool execution outline containing all items
 * @param thinkingBlockCount - Number of thinking blocks in the process (for "思考了X轮")
 * @param t - i18n translation function
 * @returns Summary string like "运行了3个命令，查看了2个文件，编辑了1个文件"
 */
export function buildProcessSummary(
  outline: ToolExecutionOutline | null,
  thinkingBlockCount: number,
  t: TFunction
): string | null {
  if (!outline) return null

  const visibleItems = outline.items.filter((item) => item.visibility !== 'hidden')
  if (visibleItems.length === 0 && thinkingBlockCount === 0) return null

  const counts = countByCategory(visibleItems)
  const parts: string[] = []

  if (thinkingBlockCount > 0) {
    parts.push(
      t('workbench.summaryThinking', {
        count: thinkingBlockCount,
        defaultValue: `思考了${thinkingBlockCount}轮`,
      })
    )
  }

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

  if (counts.other > 0) {
    parts.push(
      t('workbench.summaryOther', {
        count: counts.other,
        defaultValue: `执行了${counts.other}个操作`,
      })
    )
  }

  return parts.length > 0 ? parts.join('，') : null
}
