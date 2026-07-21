import type { ToolResultContent } from '../api/types'
import {
  compactShellOutputPayload,
  compactShellText
} from '../../../../shared/shell-output-compactor'
import { decodeStructuredToolResult, encodeStructuredToolResult } from './tool-result-format'

const BASH_RESULT_PREVIEW_CHARS = 5_000
const BASH_RESULT_PREVIEW_LINES = 120
const BASH_IMPORTANT_LINE_LIMIT = 80

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function compactTextBlock(text: string): string {
  const preview = compactShellText(text, {
    stdoutMaxChars: BASH_RESULT_PREVIEW_CHARS,
    streamMaxLines: BASH_RESULT_PREVIEW_LINES,
    importantLineLimit: BASH_IMPORTANT_LINE_LIMIT
  })
  return preview.truncated ? preview.text : text
}

export function compactBashExecutionResult(
  payload: Record<string, unknown>
): Record<string, unknown> {
  return compactShellOutputPayload(payload, {
    stdoutMaxChars: BASH_RESULT_PREVIEW_CHARS,
    stderrMaxChars: BASH_RESULT_PREVIEW_CHARS,
    streamMaxLines: BASH_RESULT_PREVIEW_LINES,
    importantLineLimit: BASH_IMPORTANT_LINE_LIMIT
  })
}

export function encodeBashToolResult(payload: Record<string, unknown>): string {
  return encodeStructuredToolResult(compactBashExecutionResult(payload))
}

export function compactBashToolResultContent(output: ToolResultContent): ToolResultContent {
  if (typeof output === 'string') {
    const decoded = decodeStructuredToolResult(output)
    if (isRecord(decoded)) {
      return encodeStructuredToolResult(compactBashExecutionResult(decoded))
    }

    return compactTextBlock(output)
  }

  return output.map((block) => {
    if (block.type !== 'text') return block
    const text = compactTextBlock(block.text)
    return text === block.text ? block : { ...block, text }
  })
}
