import {
  type AgentStreamEvent,
  type AgentStreamEnvelope,
  CHAT_STREAM_EVENTS,
  ACTIVITY_PANEL_EVENTS
} from '@shared/agent-stream-protocol'

export type ChatStreamEvent = Extract<
  AgentStreamEvent,
  { type: 'loop_start' | 'loop_end' | 'text_delta' | 'thinking_delta' | 'thinking_encrypted' | 'message_end' | 'error' }
>

export type ActivityPanelEvent = Extract<
  AgentStreamEvent,
  { type: 'iteration_start' | 'iteration_end' | 'tool_use_streaming_start' | 'tool_use_args_delta' | 'tool_use_generated' | 'tool_call_start' | 'tool_call_result' | 'context_compression_start' | 'context_compressed' | 'request_debug' }
>

export function isChatStreamEvent(event: AgentStreamEvent): event is ChatStreamEvent {
  return CHAT_STREAM_EVENTS.has(event.type)
}

export function isActivityPanelEvent(event: AgentStreamEvent): event is ActivityPanelEvent {
  return ACTIVITY_PANEL_EVENTS.has(event.type)
}

/**
 * Splits envelope events into chat stream and activity panel channels.
 */
export function splitEnvelope(envelope: AgentStreamEnvelope): {
  chatEvents: ChatStreamEvent[]
  activityEvents: ActivityPanelEvent[]
} {
  const chatEvents: ChatStreamEvent[] = []
  const activityEvents: ActivityPanelEvent[] = []

  for (const event of envelope.events) {
    if (isChatStreamEvent(event)) {
      chatEvents.push(event)
    } else if (isActivityPanelEvent(event)) {
      activityEvents.push(event)
    }
  }

  return { chatEvents, activityEvents }
}
