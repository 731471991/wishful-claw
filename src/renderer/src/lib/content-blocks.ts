import type { ContentBlock, WebSearchBlock } from '@renderer/lib/api/types'

/**
 * Append `block`, or — for a provider-native web_search block carrying an id — replace
 * the existing block with the same id in place.
 *
 * A server-side web search streams a live "searching" block when it starts and a
 * resolved "completed" block (query + sources) when it finishes; both share the same
 * id. Upserting keeps a single component that updates in place rather than stacking a
 * duplicate. Any other block type is always appended.
 */
export function appendOrUpsertContentBlock(blocks: ContentBlock[], block: ContentBlock): void {
  if (block.type === 'web_search' && block.id) {
    const idx = blocks.findIndex(
      (b) => b.type === 'web_search' && (b as WebSearchBlock).id === block.id
    )
    if (idx !== -1) {
      blocks[idx] = block
      return
    }
  }
  blocks.push(block)
}
