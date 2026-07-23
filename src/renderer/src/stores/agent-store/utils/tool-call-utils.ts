import type { ToolCallState } from '../../../lib/agent/types'
import type { ToolResultContent } from '../../../lib/api/types'
import { compactBashToolResultContent } from '../../../lib/tools/bash-output'
import { summarizeToolInputForHistory } from '../../../lib/tools/tool-input-sanitizer'
import {
  MAX_TOOL_INPUT_PREVIEW_CHARS,
  MAX_TOOL_OUTPUT_TEXT_CHARS,
  MAX_TOOL_ERROR_CHARS,
  MAX_IMAGE_BASE64_CHARS,
  MAX_TRACKED_TOOL_CALLS,
  SHELL_TOOL_NAMES
} from '../constants'

export function truncateText(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}\n... [truncated, ${value.length} chars total]`
}

export function sigHasEntry(sig: string, value: string): boolean {
  if (!sig || !value) return false
  return sig.split('\u0000').includes(value)
}

function normalizeToolInput(
  input: Record<string, unknown>,
  toolName?: string
): Record<string, unknown> {
  const summarized = toolName ? summarizeToolInputForHistory(toolName, input) : input
  try {
    const serialized = JSON.stringify(summarized)
    if (serialized.length <= MAX_TOOL_INPUT_PREVIEW_CHARS) return summarized
    return {
      _truncated: true,
      preview: truncateText(serialized, MAX_TOOL_INPUT_PREVIEW_CHARS)
    }
  } catch {
    return { _truncated: true, preview: '[unserializable input]' }
  }
}

function normalizeToolCallInput(
  toolName: string | undefined,
  input: Record<string, unknown>
): Record<string, unknown> {
  return normalizeToolInput(input, toolName)
}

function limitToolResultContent(
  output: ToolResultContent | undefined
): ToolResultContent | undefined {
  if (output === undefined) return undefined
  if (typeof output === 'string') {
    return truncateText(output, MAX_TOOL_OUTPUT_TEXT_CHARS)
  }

  const normalized: Array<
    | { type: 'text'; text: string }
    | {
        type: 'image'
        source: {
          type: 'base64' | 'url'
          mediaType?: string
          data?: string
          url?: string
          filePath?: string
        }
      }
  > = []
  let totalChars = 0

  for (const block of output) {
    if (block.type === 'text') {
      const text = truncateText(block.text, MAX_TOOL_OUTPUT_TEXT_CHARS)
      totalChars += text.length
      normalized.push({ ...block, text })
      if (totalChars >= MAX_TOOL_OUTPUT_TEXT_CHARS) {
        normalized.push({
          type: 'text',
          text: `[tool output truncated after ${MAX_TOOL_OUTPUT_TEXT_CHARS} chars]`
        })
        break
      }
      continue
    }

    if (
      block.type === 'image' &&
      block.source.data &&
      block.source.data.length > MAX_IMAGE_BASE64_CHARS
    ) {
      const sourceWithoutData = { ...block.source }
      delete sourceWithoutData.data
      if (sourceWithoutData.filePath || sourceWithoutData.url) {
        normalized.push({
          type: 'image',
          source: sourceWithoutData
        })
        continue
      }

      normalized.push({
        type: 'text',
        text: `[image data omitted, ${block.source.data.length} base64 chars]`
      })
      continue
    }

    normalized.push(block)
  }

  return normalized
}

function normalizeToolOutput(
  toolName: string | undefined,
  output: ToolResultContent | undefined
): ToolResultContent | undefined {
  if (output === undefined) return undefined
  const compacted =
    toolName && SHELL_TOOL_NAMES.has(toolName) ? compactBashToolResultContent(output) : output
  return limitToolResultContent(compacted)
}

export function normalizeToolCall(tc: ToolCallState): ToolCallState {
  return {
    ...tc,
    input: normalizeToolCallInput(tc.name, tc.input),
    output: normalizeToolOutput(tc.name, tc.output),
    error: tc.error ? truncateText(tc.error, MAX_TOOL_ERROR_CHARS) : tc.error
  }
}

export function normalizeToolCallPatch(
  patch: Partial<ToolCallState>,
  toolName?: string
): Partial<ToolCallState> {
  return {
    ...patch,
    ...(patch.input ? { input: normalizeToolCallInput(patch.name ?? toolName, patch.input) } : {}),
    ...(patch.output !== undefined
      ? { output: normalizeToolOutput(patch.name ?? toolName, patch.output) }
      : {}),
    ...(patch.error ? { error: truncateText(patch.error, MAX_TOOL_ERROR_CHARS) } : {})
  }
}

export function toolCallPatchHasChanges(existing: ToolCallState, patch: Partial<ToolCallState>): boolean {
  for (const [key, nextValue] of Object.entries(patch)) {
    const currentValue = (existing as unknown as Record<string, unknown>)[key]
    if (Object.is(currentValue, nextValue)) continue

    if (typeof currentValue === 'object' && typeof nextValue === 'object') {
      try {
        const a = JSON.stringify(currentValue)
        const b = JSON.stringify(nextValue)
        if (a === b) continue
      } catch {
        // If either value can't be stringified, treat it as changed.
      }
    }

    return true
  }
  return false
}

export function trimToolCallArray(toolCalls: ToolCallState[]): void {
  if (toolCalls.length <= MAX_TRACKED_TOOL_CALLS) return
  toolCalls.splice(0, toolCalls.length - MAX_TRACKED_TOOL_CALLS)
}

export function cloneToolCallArray(toolCalls: ToolCallState[]): ToolCallState[] {
  return toolCalls.map((toolCall) => ({ ...toolCall }))
}
