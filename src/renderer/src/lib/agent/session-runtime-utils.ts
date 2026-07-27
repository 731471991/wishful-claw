import type {
  ContentBlock,
  ThinkingBlock,
  TokenUsage,
  ToolUseBlock,
  UnifiedMessage
} from '@renderer/lib/api/types'
import { emitSessionRuntimeSync } from '@renderer/lib/session-runtime-sync'
import { appendOrUpsertContentBlock } from '@renderer/lib/content-blocks'
import { useChatStore } from '@renderer/stores/chat-store'
import { summarizeToolInputForHistory } from '@renderer/lib/tools/tool-input-sanitizer'
import { useBackgroundSessionStore } from '@renderer/stores/background-session-store'
import { recordStreamingForegroundFlush } from '@renderer/lib/streaming-perf'
import { createResidentRequestDebugInfo } from '@renderer/lib/debug-store'
import { mergeUsageSnapshot } from './usage-merge'

/**
 * Strip any <think>...</think> markers streamed by providers that wrap thinking in pseudo-tags.
 * Mirrors the chat-store helper so buffered writes share the same sanitization.
 */
export function stripThinkTagMarkers(text: string): string {
  return text.replace(/<\s*\/?\s*think\s*>/gi, '')
}

export function upsertBufferedToolUse(blocks: ContentBlock[], toolUse: ToolUseBlock): void {
  const existingIndex = blocks.findIndex(
    (block): block is ToolUseBlock => block.type === 'tool_use' && block.id === toolUse.id
  )

  if (existingIndex === -1) {
    blocks.push(toolUse)
    return
  }

  const existing = blocks[existingIndex] as ToolUseBlock
  blocks[existingIndex] = {
    ...existing,
    ...toolUse,
    input: toolUse.input
  }
}

// --- Visible session cache (50 ms TTL) ---
// getVisibleSessionIds() is called per-event during streaming — caching avoids
// re-creating a Set and reading two stores on every invocation.
let _cachedVisibleIds: Set<string> | null = null
let _cachedVisibleIdsTs = 0
const VISIBLE_IDS_CACHE_TTL_MS = 50
export const _explicitVisibleSessionIds = new Set<string>()

/**
 * Invalidate the visible-session cache. Call this whenever `activeSessionId`
 * changes so the next `isSessionForeground` call picks up the new value immediately.
 */
export function invalidateVisibleSessionCache(): void {
  _cachedVisibleIds = null
}

export function setSessionForegroundVisibility(sessionId: string, visible: boolean): void {
  const normalizedSessionId = sessionId.trim()
  if (!normalizedSessionId) return

  if (visible) {
    _explicitVisibleSessionIds.add(normalizedSessionId)
  } else {
    _explicitVisibleSessionIds.delete(normalizedSessionId)
  }
  invalidateVisibleSessionCache()
}

// --- Debounced markSessionUpdate ---
// During streaming, mutateBufferedMessage fires every ~33 ms.  Updating
// unreadCountsBySession that often forces SessionListPanel to re-render at
// ~30 fps for a purely informational badge.  Debouncing at 500 ms reduces
// background-store set() calls to ~2/s while keeping the badge responsive
// enough for the user to notice activity.
const _pendingSessionUpdates = new Map<string, ReturnType<typeof setTimeout>>()
const MARK_SESSION_UPDATE_DEBOUNCE_MS = 500

export function debouncedMarkSessionUpdate(sessionId: string): void {
  if (_pendingSessionUpdates.has(sessionId)) return
  _pendingSessionUpdates.set(
    sessionId,
    setTimeout(() => {
      _pendingSessionUpdates.delete(sessionId)
      useBackgroundSessionStore.getState().markSessionUpdate(sessionId)
    }, MARK_SESSION_UPDATE_DEBOUNCE_MS)
  )
}

export function cancelDebouncedMarkSessionUpdate(sessionId: string): void {
  const timer = _pendingSessionUpdates.get(sessionId)
  if (timer) {
    clearTimeout(timer)
    _pendingSessionUpdates.delete(sessionId)
  }
}

/**
 * Seed resolver used by background mutations. Looks up the current chat-store snapshot so
 * the background buffer can clone an authoritative source message the first time a delta
 * references an id it hasn't buffered yet.
 */
