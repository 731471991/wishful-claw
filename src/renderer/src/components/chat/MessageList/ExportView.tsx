import * as React from 'react'
import type { UnifiedMessage } from '@renderer/lib/api/types'
import type { RequestRetryState } from '@renderer/lib/agent/types'
import { MessageRow } from './MessageRow'
import type {
  MessageListProps,
  RenderableMessage,
  ToolResultsLookup,
  ChatStoreSnapshot
} from './utils'
import type { OrchestrationRunStore } from '@renderer/lib/orchestration/build-runs'
import { mergeHiddenToolUseIds } from './utils'

interface ExportViewProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  renderableMessages: RenderableMessage[]
  messageLookup: Map<string, UnifiedMessage>
  toolResultsLookup: ToolResultsLookup
  inlineCompactSummaryState: { byAssistantId: Map<string, UnifiedMessage[]> }
  orchestrationState: OrchestrationRunStore
  duplicatePlanReviewToolUseIds: Set<string>
  sessionAssistantMessageIds: string[]
  sessionToolUseIds: string[]
  streamingMessageId: string | null
  sessionRequestRetryState: RequestRetryState | null
  targetSessionId: string | null
  fullWidth: boolean
  onRetry: MessageListProps['onRetry']
  onContinue: MessageListProps['onContinue']
  onEditUserMessage: MessageListProps['onEditUserMessage']
  onDeleteMessage: MessageListProps['onDeleteMessage']
}

export function ExportView(props: ExportViewProps): React.JSX.Element {
  const {
    containerRef,
    renderableMessages,
    messageLookup,
    toolResultsLookup,
    inlineCompactSummaryState,
    orchestrationState,
    duplicatePlanReviewToolUseIds,
    sessionAssistantMessageIds,
    sessionToolUseIds,
    streamingMessageId,
    sessionRequestRetryState,
    targetSessionId,
    fullWidth,
    onRetry,
    onContinue,
    onEditUserMessage,
    onDeleteMessage
  } = props

  return (
    <div ref={containerRef} className="relative h-full flex-1" data-message-list>
      <div data-message-content>
        {renderableMessages.map((row) => {
          const message = messageLookup.get(row.messageId)
          if (!message) return null

          return (
            <MessageRow
              key={row.messageId}
              message={message}
              sessionId={targetSessionId}
              sessionAssistantMessageIds={sessionAssistantMessageIds}
              sessionToolUseIds={sessionToolUseIds}
              isStreaming={streamingMessageId === row.messageId}
              isLastUserMessage={row.isLastUserMessage}
              isLastAssistantMessage={row.isLastAssistantMessage}
              showContinue={row.showContinue}
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
              requestRetryState={
                row.isLastAssistantMessage ? (sessionRequestRetryState ?? null) : null
              }
              fullWidth={fullWidth}
              onRetry={onRetry}
              onContinue={onContinue}
              onEditUserMessage={onEditUserMessage}
              onDeleteMessage={onDeleteMessage}
            />
          )
        })}
      </div>
    </div>
  )
}
