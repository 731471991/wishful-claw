import * as React from 'react'
import type { UnifiedMessage } from '@renderer/lib/api/types'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useTeamStore } from '@renderer/stores/team-store'
import { buildOrchestrationRuns } from '@renderer/lib/orchestration/build-runs'
import { resolveActiveCompactArtifacts } from '@renderer/lib/agent/context-compression'
import { selectSessionScopedAgentState } from '@renderer/lib/agent/session-scoped-agent-state'
import { MessageRow } from './MessageRow'
import {
  buildChatRenderableMessageMetaFromAnalysis,
  buildTranscriptStaticAnalysis,
} from '../transcript-utils'
import {
  collectDuplicatePlanReviewToolUseIds,
  getMessageToolUseIds,
  mergeHiddenToolUseIds,
  selectSessionScopedTeamState,
  EMPTY_ORCHESTRATION_STATE,
} from './utils'

export interface StaticMessageTranscriptProps {
  sessionId?: string | null
  messages: UnifiedMessage[]
  className?: string
}

export function StaticMessageTranscript({
  sessionId,
  messages,
  className
}: StaticMessageTranscriptProps): React.JSX.Element {
  const transcriptAnalysis = React.useMemo(
    () => buildTranscriptStaticAnalysis(messages),
    [messages]
  )
  const { messageLookup, toolResultsLookup } = transcriptAnalysis
  const duplicatePlanReviewToolUseIds = React.useMemo(
    () => collectDuplicatePlanReviewToolUseIds(messages, toolResultsLookup),
    [messages, toolResultsLookup]
  )
  const renderableMessages = React.useMemo(
    () => buildChatRenderableMessageMetaFromAnalysis(transcriptAnalysis, null, null),
    [transcriptAnalysis]
  )
  const inlineCompactSummaryState = React.useMemo(() => {
    const byAssistantId = new Map<string, UnifiedMessage[]>()
    const summaryIds = new Set<string>()
    const activeCompact = resolveActiveCompactArtifacts(messages)
    const activeSummaryId = activeCompact?.summaryId ?? null
    if (!activeSummaryId) return { byAssistantId, summaryIds }

    const summary = messages.find((message) => message.id === activeSummaryId)
    const anchor = summary?.meta?.compactSummary?.displayAnchor
    if (!summary || !anchor?.assistantMessageId) return { byAssistantId, summaryIds }

    const assistantExists = messages.some(
      (message) => message.id === anchor.assistantMessageId && message.role === 'assistant'
    )
    if (!assistantExists) return { byAssistantId, summaryIds }

    byAssistantId.set(anchor.assistantMessageId, [summary])
    summaryIds.add(summary.id)
    return { byAssistantId, summaryIds }
  }, [messages])
  const assistantChangeTargets = React.useMemo(
    () =>
      messages
        .filter((message) => message.role === 'assistant')
        .map((message) => ({
          messageId: message.id,
          toolUseIds: getMessageToolUseIds(message)
        })),
    [messages]
  )
  const sessionAssistantMessageIds = React.useMemo(
    () => assistantChangeTargets.map((target) => target.messageId),
    [assistantChangeTargets]
  )
  const sessionToolUseIds = React.useMemo(
    () => Array.from(new Set(assistantChangeTargets.flatMap((target) => target.toolUseIds))),
    [assistantChangeTargets]
  )
  const {
    activeSubAgents,
    completedSubAgents,
    subAgentHistory,
    hasOrchestrationData: hasAgentOrchestrationData
  } = useAgentStore((s) => selectSessionScopedAgentState(s, sessionId, { mode: 'coarse' }))
  const {
    activeTeam,
    teamHistory,
    hasOrchestrationData: hasTeamOrchestrationData
  } = useTeamStore((s) => selectSessionScopedTeamState(s, sessionId))
  const hasSessionOrchestrationData = hasAgentOrchestrationData || hasTeamOrchestrationData
  const orchestrationState = React.useMemo(
    () =>
      hasSessionOrchestrationData
        ? buildOrchestrationRuns({
            sessionId,
            messages,
            activeSubAgents,
            completedSubAgents,
            subAgentHistory,
            activeTeam,
            teamHistory
          })
        : EMPTY_ORCHESTRATION_STATE,
    [
      activeSubAgents,
      activeTeam,
      completedSubAgents,
      hasSessionOrchestrationData,
      messages,
      sessionId,
      subAgentHistory,
      teamHistory
    ]
  )

  return (
    <div className={className} data-message-content data-session-image-transcript>
      {renderableMessages
        .filter((row) => !inlineCompactSummaryState.summaryIds.has(row.messageId))
        .map((row) => {
          const message = messageLookup.get(row.messageId)
          if (!message) return null

          return (
            <MessageRow
              key={row.messageId}
              message={message}
              sessionId={sessionId}
              sessionAssistantMessageIds={sessionAssistantMessageIds}
              sessionToolUseIds={sessionToolUseIds}
              isStreaming={false}
              isLastUserMessage={row.isLastUserMessage}
              isLastAssistantMessage={row.isLastAssistantMessage}
              showContinue={false}
              disableAnimation
              toolResults={toolResultsLookup.get(row.messageId)}
              inlineCompactSummaries={inlineCompactSummaryState.byAssistantId.get(row.messageId)}
              orchestrationRun={
                orchestrationState.byMessageId.get(row.messageId)?.primaryRun ?? null
              }
              hiddenToolUseIds={mergeHiddenToolUseIds(
                orchestrationState.byMessageId.get(row.messageId)?.hiddenToolUseIds,
                duplicatePlanReviewToolUseIds
              )}
              anchorMessageId={null}
              highlightMessageId={null}
              renderMode="transcript"
              requestRetryState={null}
              showChangeSummary={false}
            />
          )
        })}
    </div>
  )
}
