// ExecutionProcessBlock — wraps the "execution process" (thinking + tool calls + intermediate text)
// in a collapsible block. The final reply text is rendered outside this block.
//
// Behavior:
// - collapsible=false: not rendered (no process content)
// - collapsible=true + isStreaming: expanded, showing live process
// - collapsible=true + !isStreaming: auto-collapsed, showing summary
// - User can manually toggle; once toggled, auto behavior is overridden

import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { GenerationProcessLine } from './ui-buttons'
import { CollapsibleHeightPanel } from '../CollapsibleHeightPanel'

export interface ExecutionProcessBlockProps {
  /** Whether the block can collapse. true when there is process content (thinking/tool_use/intermediate text). */
  collapsible: boolean
  /** Whether the Agent is currently streaming (executing). */
  isStreaming: boolean
  /** Summary text shown when collapsed (e.g., "运行了3个命令，查看了2个文件"). */
  summary?: string | null
  /** Optional active detail text shown while streaming (e.g., "Running Bash..."). */
  activeDetail?: string | null
  /** Process content: thinking blocks, tool calls, intermediate text. */
  children: React.ReactNode
}

export function ExecutionProcessBlock({
  collapsible,
  isStreaming,
  summary,
  activeDetail,
  children
}: ExecutionProcessBlockProps): React.JSX.Element | null {
  const [userToggled, setUserToggled] = useState(false)
  const [userExpanded, setUserExpanded] = useState(false)

  // Reset user override when streaming restarts (new user message → new execution)
  useEffect(() => {
    if (isStreaming) {
      setUserToggled(false)
      setUserExpanded(false)
    }
  }, [isStreaming])

  // Auto behavior: expanded while streaming, collapsed when done
  // User override takes precedence once toggled
  const expanded = userToggled ? userExpanded : isStreaming

  const handleToggle = useCallback(() => {
    if (!userToggled) {
      setUserExpanded(!expanded)
    } else {
      setUserExpanded((prev) => !prev)
    }
    setUserToggled(true)
  }, [expanded, userToggled])

  if (!collapsible) return null

  const detail = isStreaming
    ? (activeDetail ?? undefined)
    : (summary ?? undefined)

  return (
    <div className="space-y-1">
      <GenerationProcessLine
        active={isStreaming}
        label={isStreaming ? 'Executing' : 'Executed'}
        detail={detail}
        collapsible={true}
        expanded={expanded}
        onClick={handleToggle}
      />
      <CollapsibleHeightPanel open={expanded} className="overflow-hidden">
        <div className="space-y-2 border-l border-border/40 ml-2.5 pl-2.5">
          {children}
        </div>
      </CollapsibleHeightPanel>
    </div>
  )
}
