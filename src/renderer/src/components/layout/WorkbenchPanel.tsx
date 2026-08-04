// WorkbenchPanel — right panel tab showing full tool call previews for the
// current session. Complements the compact tool cards in the chat flow's
// execution process block.

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useAgentStore } from '@renderer/stores/agent-store'
import type { ToolCallState } from '@renderer/lib/agent/types'
import { ToolCallCard } from '@renderer/components/chat/ToolCallCard'



export interface WorkbenchPanelProps {
  sessionId: string | null
}

function resolveToolCallProps(tc: ToolCallState) {
  return {
    toolUseId: tc.id,
    name: tc.name,
    input: tc.input,
    output: tc.output,
    status: tc.status,
    error: tc.error,
    startedAt: tc.startedAt,
    completedAt: tc.completedAt,
    mode: 'full' as const,
  }
}

function EmptyState({ t }: { t: (key: string, options?: Record<string, unknown>) => string }): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground/60">
          {t('workbench.emptyHint', { defaultValue: '工具调用执行详情将在此显示' })}
        </p>
      </div>
    </div>
  )
}

export function WorkbenchPanel({ sessionId }: WorkbenchPanelProps): React.JSX.Element {
  const { t } = useTranslation('chat')

  const toolCalls = useAgentStore(
    useShallow((s) => {
      if (!sessionId) return []
      const cache = s.sessionToolCallsCache[sessionId]
      if (cache) {
        return [...cache.pending, ...cache.executed]
      }
      // Fallback: filter global by sessionId
      return [
        ...s.pendingToolCalls.filter((tc) => tc.sessionId === sessionId),
        ...s.executedToolCalls.filter((tc) => tc.sessionId === sessionId),
      ]
    })
  )

  // Sort by startedAt (oldest first), fallback to insertion order
  const sortedToolCalls = React.useMemo(() => {
    return [...toolCalls].sort((a, b) => {
      const aTime = a.startedAt ?? 0
      const bTime = b.startedAt ?? 0
      return aTime - bTime
    })
  }, [toolCalls])

  if (sortedToolCalls.length === 0) {
    return <EmptyState t={t} />
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-2 p-2">
        {sortedToolCalls.map((tc) => (
          <ToolCallCard key={tc.id} {...resolveToolCallProps(tc)} />
        ))}
      </div>
    </div>
  )
}
