
import type { BackgroundProcessState, BufferedProcessOutputEvent } from '../types'
import { MAX_BACKGROUND_PROCESS_OUTPUT_CHARS, MAX_BACKGROUND_PROCESS_ENTRIES } from '../constants'
import { truncateText } from './tool-call-utils'

export function appendBackgroundOutput(existing: string, chunk: string): string {
  const next = `${existing}${chunk}`
  if (next.length <= MAX_BACKGROUND_PROCESS_OUTPUT_CHARS) return next
  return truncateText(next, MAX_BACKGROUND_PROCESS_OUTPUT_CHARS)
}

export function trimBackgroundProcessMap(map: Record<string, BackgroundProcessState>): void {
  const entries = Object.entries(map).sort((a, b) => a[1].updatedAt - b[1].updatedAt)
  if (entries.length <= MAX_BACKGROUND_PROCESS_ENTRIES) return
  const removeCount = entries.length - MAX_BACKGROUND_PROCESS_ENTRIES
  for (let i = 0; i < removeCount; i++) {
    delete map[entries[i][0]]
  }
}

export function buildBackgroundProcessSummary(process: BackgroundProcessState): BackgroundProcessState {
  return {
    ...process,
    output: ''
  }
}

export function applyProcessOutputEvent(
  existing: BackgroundProcessState | undefined,
  payload: BufferedProcessOutputEvent,
  now: number
): BackgroundProcessState {
  const next: BackgroundProcessState = existing
    ? { ...existing }
    : {
        id: payload.id,
        command: '',
        cwd: undefined,
        sessionId: payload.metadata?.sessionId,
        toolUseId: payload.metadata?.toolUseId,
        description: payload.metadata?.description,
        source: payload.metadata?.source,
        terminalId: payload.metadata?.terminalId,
        status: payload.exited ? 'exited' : 'running',
        output: '',
        port: payload.port,
        exitCode: payload.exitCode,
        createdAt: now,
        updatedAt: now
      }

  if (payload.data) {
    next.output = appendBackgroundOutput(next.output, payload.data)
  }
  if (payload.port) next.port = payload.port
  if (payload.metadata) {
    next.sessionId = payload.metadata.sessionId ?? next.sessionId
    next.toolUseId = payload.metadata.toolUseId ?? next.toolUseId
    next.description = payload.metadata.description ?? next.description
    next.source = payload.metadata.source ?? next.source
    next.terminalId = payload.metadata.terminalId ?? next.terminalId
  }
  if (payload.exited) {
    next.status = next.status === 'stopped' ? 'stopped' : 'exited'
    next.exitCode = payload.exitCode
  }
  next.updatedAt = now

  return next
}
