import * as React from 'react'
import { MessageItem } from '../MessageItem'
import { SessionChangeSummaryCard } from '../SessionChangeSummaryCard'
import {
  type MessageRowProps,
  getMessageToolUseIds,
  getMessageColumnClass,
  areMessageRowPropsEqual,
} from './utils'

export const MessageRow = React.memo(function MessageRow({
  message,
  sessionId,
  sessionAssistantMessageIds,
  sessionToolUseIds,
  isStreaming,
  isLastUserMessage,
  isLastAssistantMessage,
  showContinue,
  disableAnimation,
  toolResults,
  inlineCompactSummaries,
  orchestrationRun,
  hiddenToolUseIds,
  anchorMessageId,
  highlightMessageId,
  requestRetryState,
  renderMode,
  showChangeSummary = true,
  fullWidth = false,
  onRetry,
  onContinue,
  onEditUserMessage,
  onDeleteMessage
}: MessageRowProps): React.JSX.Element {
  const isAnchor = anchorMessageId === message.id
  const isHighlighted = highlightMessageId === message.id
  const messageToolUseIds = React.useMemo(() => getMessageToolUseIds(message), [message])

  return (
    <div
      data-message-id={message.id}
      data-anchor={isAnchor ? 'true' : undefined}
      className={`${getMessageColumnClass(fullWidth)} pb-7 transition-colors duration-500 ${
        isHighlighted ? 'rounded-md bg-primary/5 ring-1 ring-primary/20' : ''
      }`}
    >
      <MessageItem
        message={message}
        messageId={message.id}
        sessionId={sessionId}
        sessionAssistantMessageIds={sessionAssistantMessageIds}
        sessionToolUseIds={sessionToolUseIds}
        isStreaming={isStreaming}
        isLastUserMessage={isLastUserMessage}
        isLastAssistantMessage={isLastAssistantMessage}
        showContinue={showContinue}
        disableAnimation={disableAnimation}
        renderMode={renderMode}
        onRetryAssistantMessage={onRetry}
        onContinueAssistantMessage={onContinue}
        onEditUserMessage={onEditUserMessage}
        onDeleteMessage={onDeleteMessage}
        toolResults={toolResults}
        inlineCompactSummaries={inlineCompactSummaries}
        orchestrationRun={orchestrationRun}
        hiddenToolUseIds={hiddenToolUseIds}
        requestRetryState={requestRetryState}
      />
      {showChangeSummary && message.role === 'assistant' && !isStreaming && sessionId ? (
        <div className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
          <SessionChangeSummaryCard
            sessionId={sessionId}
            messageId={message.id}
            toolUseIds={messageToolUseIds}
          />
        </div>
      ) : null}
    </div>
  )
}, areMessageRowPropsEqual)
