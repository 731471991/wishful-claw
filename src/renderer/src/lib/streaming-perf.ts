type SampleBucket =
  | 'toolArgs'
  | 'foregroundFlush'
  | 'reactCommit'
  | 'renderPool'
  | 'rafGap'
  | 'longTask'

interface DurationSample {
  durationMs: number
  at: number
  detail?: Record<string, unknown>
}

interface StreamingPerfSnapshot {
  enabled: boolean
  samples: Record<SampleBucket, DurationSample[]>
  summary: Record<SampleBucket, { count: number; p95Ms: number; maxMs: number }>
  failures: string[]
}

interface StreamingPerfApi {
  snapshot: () => StreamingPerfSnapshot
  reset: () => void
}

const MAX_SAMPLES = 800
const LONG_TASK_LIMIT_MS = 50
const RAF_P95_LIMIT_MS = 25
const RAF_MAX_LIMIT_MS = 80
const TOOL_ARGS_P95_LIMIT_MS = 2
const TOOL_ARGS_MAX_LIMIT_MS = 8
const RENDER_POOL_P95_LIMIT_MS = 2
const RENDER_POOL_MAX_LIMIT_MS = 8

const enabled =
  typeof window !== 'undefined' &&
  Boolean(import.meta.env?.DEV) &&
  !window.location.hash.startsWith('#notify')

const samples: Record<SampleBucket, DurationSample[]> = {
  toolArgs: [],
  foregroundFlush: [],
  reactCommit: [],
  renderPool: [],
  rafGap: [],
  longTask: []
}

let installed = false
let rafId: number | null = null
let longTaskObserver: PerformanceObserver | null = null

function pushSample(
  bucket: SampleBucket,
  durationMs: number,
  detail?: Record<string, unknown>
): void {
  if (!enabled || !Number.isFinite(durationMs)) return
  const list = samples[bucket]
  list.push({
    durationMs,
    at: Date.now(),
    ...(detail ? { detail } : {})
  })
  if (list.length > MAX_SAMPLES) {
    list.splice(0, list.length - MAX_SAMPLES)
  }
}

function percentile(sorted: number[], ratio: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)
  return sorted[index]
}

function summarize(bucket: SampleBucket): { count: number; p95Ms: number; maxMs: number } {
  const durations = samples[bucket].map((sample) => sample.durationMs).sort((a, b) => a - b)
  return {
    count: durations.length,
    p95Ms: percentile(durations, 0.95),
    maxMs: durations.length > 0 ? durations[durations.length - 1] : 0
  }
}

function buildFailures(summary: StreamingPerfSnapshot['summary']): string[] {
  const failures: string[] = []
  if (summary.longTask.maxMs > LONG_TASK_LIMIT_MS) {
    failures.push(`longTask max ${summary.longTask.maxMs.toFixed(1)}ms > ${LONG_TASK_LIMIT_MS}ms`)
  }
  if (summary.rafGap.p95Ms > RAF_P95_LIMIT_MS) {
    failures.push(`rafGap p95 ${summary.rafGap.p95Ms.toFixed(1)}ms > ${RAF_P95_LIMIT_MS}ms`)
  }
  if (summary.rafGap.maxMs > RAF_MAX_LIMIT_MS) {
    failures.push(`rafGap max ${summary.rafGap.maxMs.toFixed(1)}ms > ${RAF_MAX_LIMIT_MS}ms`)
  }
  if (summary.toolArgs.p95Ms > TOOL_ARGS_P95_LIMIT_MS) {
    failures.push(
      `toolArgs p95 ${summary.toolArgs.p95Ms.toFixed(1)}ms > ${TOOL_ARGS_P95_LIMIT_MS}ms`
    )
  }
  if (summary.toolArgs.maxMs > TOOL_ARGS_MAX_LIMIT_MS) {
    failures.push(
      `toolArgs max ${summary.toolArgs.maxMs.toFixed(1)}ms > ${TOOL_ARGS_MAX_LIMIT_MS}ms`
    )
  }
  if (summary.renderPool.p95Ms > RENDER_POOL_P95_LIMIT_MS) {
    failures.push(
      `renderPool p95 ${summary.renderPool.p95Ms.toFixed(1)}ms > ${RENDER_POOL_P95_LIMIT_MS}ms`
    )
  }
  if (summary.renderPool.maxMs > RENDER_POOL_MAX_LIMIT_MS) {
    failures.push(
      `renderPool max ${summary.renderPool.maxMs.toFixed(1)}ms > ${RENDER_POOL_MAX_LIMIT_MS}ms`
    )
  }
  return failures
}

export function isStreamingPerfEnabled(): boolean {
  return enabled
}

export function recordStreamingToolArgsDuration(
  durationMs: number,
  detail?: Record<string, unknown>
): void {
  pushSample('toolArgs', durationMs, detail)
}

export function recordStreamingForegroundFlush(
  durationMs: number,
  detail?: Record<string, unknown>
): void {
  pushSample('foregroundFlush', durationMs, detail)
}

export function recordStreamingReactCommit(
  durationMs: number,
  detail?: Record<string, unknown>
): void {
  pushSample('reactCommit', durationMs, detail)
}

export function recordStreamingRenderPoolFlush(
  durationMs: number,
  detail?: Record<string, unknown>
): void {
  pushSample('renderPool', durationMs, detail)
}

function snapshot(): StreamingPerfSnapshot {
  const summary = {
    toolArgs: summarize('toolArgs'),
    foregroundFlush: summarize('foregroundFlush'),
    reactCommit: summarize('reactCommit'),
    renderPool: summarize('renderPool'),
    rafGap: summarize('rafGap'),
    longTask: summarize('longTask')
  }

  return {
    enabled,
    samples: {
      toolArgs: [...samples.toolArgs],
      foregroundFlush: [...samples.foregroundFlush],
      reactCommit: [...samples.reactCommit],
      renderPool: [...samples.renderPool],
      rafGap: [...samples.rafGap],
      longTask: [...samples.longTask]
    },
    summary,
    failures: buildFailures(summary)
  }
}

function reset(): void {
  for (const list of Object.values(samples)) {
    list.splice(0)
  }
}

export function installStreamingPerfMonitor(): void {
  if (!enabled || installed) return
  installed = true

  window.__openCoworkStreamingPerf = {
    snapshot,
    reset
  }

  let lastFrame = performance.now()
  const tick = (now: number): void => {
    pushSample('rafGap', now - lastFrame)
    lastFrame = now
    rafId = window.requestAnimationFrame(tick)
  }
  rafId = window.requestAnimationFrame(tick)

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          pushSample('longTask', entry.duration, {
            name: entry.name,
            startTime: entry.startTime
          })
        }
      })
      longTaskObserver.observe({ entryTypes: ['longtask'] })
    } catch {
      longTaskObserver = null
    }
  }

  window.addEventListener(
    'beforeunload',
    () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
      longTaskObserver?.disconnect()
      longTaskObserver = null
    },
    { once: true }
  )
}

declare global {
  interface Window {
    __openCoworkStreamingPerf?: StreamingPerfApi
  }
}
