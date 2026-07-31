/**
 * Seedance (Volcengine Ark) video generation helpers for the renderer.
 *
 * The actual submit → poll → download → persist pipeline runs in the MAIN process
 * (see src/main/ipc/video-handlers.ts) so generation is fully backgrounded;
 * the renderer only starts a job (video:start) and receives status events.
 * This module just holds the shared param shape + command formatting.
 *
 * Ported from WishfulClaw seedance-video-provider.ts.
 */

export interface SeedanceVideoParams {
  ratio?: string
  resolution?: string
  duration?: number
  fps?: number
  watermark?: boolean
  seed?: number
  cameraFixed?: boolean
}

/** Build the Seedance `--command` suffix appended to the prompt text. */
export function buildSeedanceCommands(params: SeedanceVideoParams): string {
  const parts: string[] = []
  if (params.ratio) parts.push(`--ratio ${params.ratio}`)
  if (params.resolution) parts.push(`--resolution ${params.resolution}`)
  if (params.duration) parts.push(`--dur ${params.duration}`)
  if (params.fps) parts.push(`--fps ${params.fps}`)
  if (typeof params.watermark === 'boolean') parts.push(`--watermark ${params.watermark}`)
  if (typeof params.cameraFixed === 'boolean') parts.push(`--camerafixed ${params.cameraFixed}`)
  if (typeof params.seed === 'number') parts.push(`--seed ${params.seed}`)
  return parts.length ? ` ${parts.join(' ')}` : ''
}
