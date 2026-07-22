import { useMemo, useRef } from 'react'

export interface StreamingMarkdownBlocks {
  settled: string[]
  tail: string
}

interface ScanState {
  prevText: string
  settled: string[]
  tailStart: number
  scanPos: number
  inFence: boolean
  fenceChar: string
  fenceLen: number
  inMath: boolean
  pendingBlankStart: number
  tailHasContent: boolean
}

const NO_SETTLED: string[] = []
const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})/
const BACKTICK_CLOSE_RE = /^`+$/
const TILDE_CLOSE_RE = /^~+$/
const INDENTED_LINE_RE = /^[ \t]/

function createScanState(): ScanState {
  return {
    prevText: '',
    settled: [],
    tailStart: 0,
    scanPos: 0,
    inFence: false,
    fenceChar: '',
    fenceLen: 0,
    inMath: false,
    pendingBlankStart: -1,
    tailHasContent: false
  }
}

/**
 * Splits streaming markdown into settled blocks plus an unsettled tail so the
 * remark/rehype pipeline only ever re-parses the tail. Re-parsing the full
 * accumulated text on every render-pool tick is O(n²) over the response and
 * saturates the main thread on long answers.
 *
 * Blocks settle at blank lines outside code fences / $$ math blocks, and only
 * when the following line starts flush left (indented lines may continue the
 * previous construct). Splitting can subtly change list/reference-link
 * rendering while streaming; the final non-streaming render always parses the
 * complete text in one pass, so the settled result is unaffected.
 */
export function useStreamingMarkdownBlocks(
  text: string,
  isStreaming: boolean
): StreamingMarkdownBlocks {
  const stateRef = useRef<ScanState | null>(null)

  return useMemo(() => {
    if (!isStreaming) {
      stateRef.current = null
      return { settled: NO_SETTLED, tail: text }
    }

    let state = stateRef.current
    if (!state || text.length < state.prevText.length || !text.startsWith(state.prevText)) {
      state = createScanState()
      stateRef.current = state
    }
    if (text === state.prevText) {
      return { settled: state.settled, tail: text.slice(state.tailStart) }
    }

    let pos = state.scanPos
    while (true) {
      const newlineIndex = text.indexOf('\n', pos)
      if (newlineIndex === -1) break
      const lineStart = pos
      const line = text.slice(lineStart, newlineIndex)
      pos = newlineIndex + 1
      const trimmed = line.trim()

      if (state.inFence) {
        if (
          trimmed.length >= state.fenceLen &&
          (state.fenceChar === '`' ? BACKTICK_CLOSE_RE : TILDE_CLOSE_RE).test(trimmed)
        ) {
          state.inFence = false
        }
        continue
      }

      if (state.inMath) {
        if (trimmed.endsWith('$$')) {
          state.inMath = false
        }
        continue
      }

      if (trimmed === '') {
        if (state.pendingBlankStart === -1 && state.tailHasContent) {
          state.pendingBlankStart = lineStart
        }
        continue
      }

      if (state.pendingBlankStart !== -1) {
        if (!INDENTED_LINE_RE.test(line)) {
          state.settled = [...state.settled, text.slice(state.tailStart, state.pendingBlankStart)]
          state.tailStart = lineStart
        }
        state.pendingBlankStart = -1
      }
      state.tailHasContent = true

      const fenceMatch = FENCE_OPEN_RE.exec(line)
      if (fenceMatch) {
        state.inFence = true
        state.fenceChar = fenceMatch[1][0]
        state.fenceLen = fenceMatch[1].length
      } else if (trimmed.startsWith('$$') && !(trimmed.length > 2 && trimmed.endsWith('$$'))) {
        state.inMath = true
      }
    }

    state.scanPos = pos
    state.prevText = text
    return { settled: state.settled, tail: text.slice(state.tailStart) }
  }, [text, isStreaming])
}
