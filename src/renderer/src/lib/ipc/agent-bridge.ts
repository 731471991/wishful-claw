import type { RequestDebugInfo } from '@renderer/lib/api/types'

export async function readSidecarDebugBody(_bodyRef: string): Promise<RequestDebugInfo | undefined> {
  return undefined
}

export async function runSidecarContextCompression(_opts: unknown): Promise<unknown> {
  throw new Error('Not implemented')
}
