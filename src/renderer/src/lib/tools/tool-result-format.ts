import { decode, encode } from '@toon-format/toon'
import { useSettingsStore } from '@renderer/stores/settings-store'

export type ToolResultFormat = 'toon' | 'json'

type StructuredToolResult = Record<string, unknown> | unknown[]

export function getCurrentToolResultFormat(): ToolResultFormat {
  return useSettingsStore.getState().toolResultFormat
}

export function encodeStructuredToolResult(
  value: StructuredToolResult,
  format: ToolResultFormat = getCurrentToolResultFormat()
): string {
  if (format === 'json') {
    return JSON.stringify(value)
  }
  return encode(value).trimEnd()
}

export function encodeToolError(
  message: string,
  format: ToolResultFormat = getCurrentToolResultFormat()
): string {
  return encodeStructuredToolResult({ error: message }, format)
}

export function decodeStructuredToolResult(text: string): StructuredToolResult | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (isStructuredToolResult(parsed)) return parsed
  } catch {
    // ignore JSON parse errors
  }

  try {
    const parsed = decode(trimmed) as unknown
    if (isStructuredToolResult(parsed)) return parsed
  } catch {
    // ignore TOON parse errors
  }

  return null
}

export function isStructuredToolResult(value: unknown): value is StructuredToolResult {
  return Array.isArray(value) || (!!value && typeof value === 'object')
}

export function isStructuredToolErrorText(text: string): boolean {
  const parsed = decodeStructuredToolResult(text)
  if (!parsed || Array.isArray(parsed)) return false
  const keys = Object.keys(parsed)
  return keys.length === 1 && typeof parsed.error === 'string'
}
