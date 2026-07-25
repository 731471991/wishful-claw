import type {
  ProviderConfig,
  StreamEvent,
  ToolDefinition,
  ToolCallExtraContent,
  UnifiedMessage
} from '@renderer/lib/api/types'
import type { CompressionResult } from '@renderer/lib/agent/context-compression'
import type { AgentEvent } from '@renderer/lib/agent/types'
import {
  RESPONSES_SESSION_SCOPE_SIDECAR_TEXT_REQUEST,
  withAuxiliaryResponsesRequestPolicy
} from '@renderer/lib/api/responses-session-policy'
import {
  buildSidecarAgentRunRequest,
  isNativeSidecarProviderConfig,
  sanitizeSidecarMessageMeta
} from '@renderer/lib/ipc/sidecar-protocol'
import type {
  SidecarSlashCommandContext,
  SidecarSystemCommandContext
} from '@renderer/lib/ipc/sidecar-protocol'
import { agentStream } from '@renderer/lib/ipc/agent-stream-receiver'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { toAgentEvent } from '@renderer/lib/agent/stream-event-adapter'

function normalizeProviderToolInput(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function toProviderErrorEvent(error: unknown): StreamEvent {
  return {
    type: 'error',
    error: {
      type: error instanceof Error ? error.name || 'sidecar_error' : 'sidecar_error',
      message: error instanceof Error ? error.message : String(error)
    }
  }
}

function mapAgentEventToProviderEvents(
  event: AgentEvent,
  startedToolIds: Set<string>
): StreamEvent[] {
  switch (event.type) {
    case 'text_delta':
      return [{ type: 'text_delta', text: event.text }]
    case 'thinking_delta':
      return [{ type: 'thinking_delta', thinking: event.thinking }]
    case 'thinking_encrypted':
      return [
        {
          type: 'thinking_encrypted',
          thinkingEncryptedContent: event.thinkingEncryptedContent,
          thinkingEncryptedProvider: event.thinkingEncryptedProvider
        }
      ]
    case 'image_generation_started':
      return [{ type: 'image_generation_started' }]
    case 'image_generation_partial':
      return [
        {
          type: 'image_generation_partial',
          imageBlock: event.imageBlock,
          ...(event.partialImageIndex !== undefined
            ? { partialImageIndex: event.partialImageIndex }
            : {})
        }
      ]
    case 'image_generated':
      return [{ type: 'image_generated', imageBlock: event.imageBlock }]
    case 'image_error':
      return [{ type: 'image_error', imageError: event.imageError }]
    case 'request_debug':
      return [{ type: 'request_debug', debugInfo: event.debugInfo }]
    case 'message_end':
      return [
        {
          type: 'message_end',
          usage: event.usage,
          timing: event.timing,
          providerResponseId: event.providerResponseId,
          stopReason: event.stopReason
        }
      ]
    case 'tool_use_streaming_start': {
      const toolCallId = event.toolCallId
      if (!toolCallId) return []
      startedToolIds.add(toolCallId)
      return [
        {
          type: 'tool_call_start',
          toolCallId,
          toolName: event.toolName,
          ...(event.toolCallExtraContent
            ? { toolCallExtraContent: event.toolCallExtraContent as ToolCallExtraContent }
            : {})
        }
      ]
    }
    case 'tool_use_generated': {
      const block = event.toolUseBlock
      if (!block?.id || !block.name) return []
      const events: StreamEvent[] = []
      if (!startedToolIds.has(block.id)) {
        startedToolIds.add(block.id)
        events.push({
          type: 'tool_call_start',
          toolCallId: block.id,
          toolName: block.name,
          ...(block.extraContent ? { toolCallExtraContent: block.extraContent } : {})
        })
      }
      events.push({
        type: 'tool_call_end',
        toolCallId: block.id,
        toolName: block.name,
        toolCallInput: normalizeProviderToolInput(block.input),
        ...(block.extraContent ? { toolCallExtraContent: block.extraContent } : {})
      })
      return events
    }
    case 'error':
      return [toProviderErrorEvent(event.error)]
    default:
      return []
  }
}

