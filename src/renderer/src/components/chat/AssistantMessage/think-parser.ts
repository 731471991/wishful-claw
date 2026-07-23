// Think tag parsing and structured block normalization

import type { ContentBlock } from '@renderer/lib/api/types'
import { THINK_OPEN_TAG_RE, type ThinkSegment } from './types'
import { stripThinkTagMarkers } from './utils'

export function parseThinkTags(text: string): ThinkSegment[] {
  if (!THINK_OPEN_TAG_RE.test(text)) {
    return [{ type: 'text', content: stripThinkTagMarkers(text) }]
  }

  const segments: ThinkSegment[] = []
  const regex = /<\s*think\s*>([\s\S]*?)(<\s*\/\s*think\s*>|$)/gi
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = stripThinkTagMarkers(text.slice(lastIndex, match.index))
      if (before.trim()) segments.push({ type: 'text', content: before })
    }
    segments.push({ type: 'think', content: stripThinkTagMarkers(match[1]), closed: !!match[2] })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    const remaining = stripThinkTagMarkers(text.slice(lastIndex))
    if (remaining.trim()) segments.push({ type: 'text', content: remaining })
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: stripThinkTagMarkers(text) }]
}

export function stripThinkTags(text: string): string {
  return text
    .replace(/<\s*think\s*>[\s\S]*?(<\s*\/\s*think\s*>|$)/gi, '')
    .replace(/<\s*\/?\s*think\s*>/gi, '')
    .trim()
}

export function normalizeStructuredBlocks(
  blocks: ContentBlock[],
  options: { preserveBoundaryAfterRawIndices?: Set<number> } = {}
): ContentBlock[] {
  const hasStructuredThinkingBlocks = blocks.some((b) => b.type === 'thinking')
  const normalized: ContentBlock[] = []
  const toolUseIndices = new Map<string, number>()

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex]
    const previousRawIndex = blockIndex - 1
    const preservePreviousBoundary = options.preserveBoundaryAfterRawIndices?.has(previousRawIndex)

    if (block.type === 'text') {
      const text = hasStructuredThinkingBlocks ? stripThinkTags(block.text) : block.text
      if (!text.trim()) continue
      const last = normalized[normalized.length - 1]
      if (last && last.type === 'text' && !preservePreviousBoundary) {
        normalized[normalized.length - 1] = { ...last, text: `${last.text}${text}` }
      } else {
        normalized.push({ ...block, text })
      }
      continue
    }

    if (block.type === 'thinking') {
      const cleanedThinking = stripThinkTagMarkers(block.thinking).trim()
      if (!cleanedThinking) continue
      const last = normalized[normalized.length - 1]
      if (last && last.type === 'thinking' && !preservePreviousBoundary) {
        const separator =
          last.thinking.endsWith('\n') || cleanedThinking.startsWith('\n') ? '' : '\n'
        normalized[normalized.length - 1] = {
          ...last,
          thinking: `${last.thinking}${separator}${cleanedThinking}`,
          startedAt: last.startedAt ?? block.startedAt,
          completedAt: block.completedAt ?? last.completedAt
        }
      } else {
        normalized.push({ ...block, thinking: cleanedThinking })
      }
      continue
    }

    if (block.type === 'tool_use' && block.id) {
      const existingIndex = toolUseIndices.get(block.id)
      if (existingIndex !== undefined) {
        normalized[existingIndex] = {
          ...(normalized[existingIndex] as Extract<ContentBlock, { type: 'tool_use' }>),
          ...block
        }
        continue
      }

      toolUseIndices.set(block.id, normalized.length)
    }

    normalized.push(block)
  }

  return normalized
}
