/**
 * Cron reverse-request handlers.
 *
 * In-memory cron job scheduler — stores jobs in a Map and uses node-cron
 * for cron-expression scheduling. One-shot ("at") and interval ("every")
 * modes use setTimeout / setInterval.
 *
 * When a job fires, it sends a `cron:fire` event to the renderer which
 * can spawn an agent run with the stored prompt.
 */

import cron from 'node-cron'
import { BrowserWindow } from 'electron'
import { safeSendMessagePackToWindow } from '../../window-ipc'

// ── Types ──

interface CronSchedule {
  kind: 'at' | 'every' | 'cron'
  at?: number | string
  every?: number
  expr?: string
  tz?: string
}

interface CronJob {
  id: string
  name: string
  sessionId?: string
  schedule: CronSchedule
  prompt: string
  agentId?: string
  model?: string
  workingFolder?: string
  deliveryMode?: 'desktop' | 'session' | 'none'
  deliveryTarget?: string
  deleteAfterRun?: boolean
  maxIterations?: number
  enabled: boolean
  deletedAt: number | null
  lastFiredAt: number | null
  fireCount: number
  createdAt: number
  updatedAt: number
}

// ── State ──

const jobs = new Map<string, CronJob>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const intervals = new Map<string, ReturnType<typeof setInterval>>()
const cronTasks = new Map<string, ReturnType<typeof cron.schedule>>()

let idCounter = 0
function generateId(): string {
  idCounter += 1
  return `cron-${Date.now().toString(36)}-${idCounter}`
}

// ── Validation ──

function resolveTimestamp(value: number | string | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') return value
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

function validateTimeZone(timeZone: string): string | null {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return null
  } catch {
    return `schedule.tz is not a valid IANA timezone: "${timeZone}"`
  }
}

function validateSchedule(schedule: CronSchedule): string | null {
  if (!schedule || !schedule.kind) return 'schedule.kind is required (at | every | cron)'
  if (schedule.kind === 'at') {
    const ts = resolveTimestamp(schedule.at)
    if (!ts) return 'schedule.at must be a valid timestamp (ms) or ISO 8601 string'
    if (ts < Date.now() - 30_000) {
      return `schedule.at is in the past (${new Date(ts).toISOString()}). Use a future timestamp.`
    }
  } else if (schedule.kind === 'every') {
    if (!schedule.every || schedule.every < 1000) return 'schedule.every must be >= 1000 ms'
  } else if (schedule.kind === 'cron') {
    const expr = schedule.expr?.trim()
    if (!expr) return 'schedule.expr is required for kind=cron'
    const parts = expr.split(/\s+/)
    if (parts.length < 5 || parts.length > 6) return 'schedule.expr must have 5 or 6 fields'
    if (!cron.validate(expr)) return `schedule.expr is not a valid cron expression: "${expr}"`
    const tzErr = validateTimeZone(schedule.tz?.trim() || 'UTC')
    if (tzErr) return tzErr
  } else {
    return `Unknown schedule.kind: "${schedule.kind}"`
  }
  return null
}

// ── Scheduling ──

function clearJobTimers(jobId: string): void {
  const t = timers.get(jobId)
  if (t) { clearTimeout(t); timers.delete(jobId) }
  const i = intervals.get(jobId)
  if (i) { clearInterval(i); intervals.delete(jobId) }
  const task = cronTasks.get(jobId)
  if (task) { task.stop(); cronTasks.delete(jobId) }
}

function fireJob(job: CronJob): void {
  job.lastFiredAt = Date.now()
  job.fireCount += 1

  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    safeSendMessagePackToWindow(win, 'cron:fire', {
      jobId: job.id,
      name: job.name,
      prompt: job.prompt,
      agentId: job.agentId,
      model: job.model,
      workingFolder: job.workingFolder,
      sessionId: job.sessionId,
      firedAt: job.lastFiredAt,
      deliveryMode: job.deliveryMode ?? 'desktop',
      deliveryTarget: job.deliveryTarget,
      maxIterations: job.maxIterations ?? 15
    })
  }

  // Handle deleteAfterRun for one-shot jobs
  if (job.deleteAfterRun) {
    clearJobTimers(job.id)
    job.deletedAt = Date.now()
  }
}

function scheduleJob(job: CronJob): boolean {
  clearJobTimers(job.id)
  const { schedule } = job

  if (schedule.kind === 'at') {
    const ts = resolveTimestamp(schedule.at)
    if (!ts || ts < Date.now()) return false
    const delay = ts - Date.now()
    timers.set(job.id, setTimeout(() => fireJob(job), delay))
    return true
  }

  if (schedule.kind === 'every') {
    const ms = schedule.every!
    intervals.set(job.id, setInterval(() => fireJob(job), ms))
    return true
  }

  if (schedule.kind === 'cron') {
    const expr = schedule.expr!
    const tz = schedule.tz ?? 'UTC'
    try {
      const task = cron.schedule(expr, () => fireJob(job), { timezone: tz })
      cronTasks.set(job.id, task)
      return true
    } catch {
      return false
    }
  }

  return false
}

// ── Handler functions ──

export async function handleCronAdd(params: Record<string, unknown>): Promise<unknown> {
  const name = (params.name ?? params.title) as string | undefined
  const prompt = params.prompt as string | undefined
  const schedule = params.schedule as CronSchedule | undefined

  if (!name) return { error: 'name (or title) is required' }
  if (!prompt) return { error: 'prompt is required' }

  const schedErr = validateSchedule(schedule!)
  if (schedErr) return { error: schedErr }

  const id = generateId()
  const now = Date.now()

  const job: CronJob = {
    id,
    name,
    sessionId: params.sessionId as string | undefined,
    schedule: schedule!,
    prompt,
    agentId: params.agentId as string | undefined,
    model: params.model as string | undefined,
    workingFolder: params.workingFolder as string | undefined,
    deliveryMode: (params.deliveryMode as CronJob['deliveryMode']) ?? 'desktop',
    deliveryTarget: params.deliveryTarget as string | undefined,
    deleteAfterRun: (params.deleteAfterRun as boolean | undefined) ?? (schedule!.kind === 'at'),
    maxIterations: (params.maxIterations as number | undefined) ?? 15,
    enabled: true,
    deletedAt: null,
    lastFiredAt: null,
    fireCount: 0,
    createdAt: now,
    updatedAt: now
  }

  const scheduled = scheduleJob(job)
  if (!scheduled) {
    return { error: `Failed to schedule job (kind=${schedule!.kind})` }
  }

  jobs.set(id, job)
  return { success: true, jobId: id, name, schedule }
}

export async function handleCronUpdate(params: Record<string, unknown>): Promise<unknown> {
  const jobId = params.jobId as string | undefined
  if (!jobId) return { error: 'jobId is required' }

  const job = jobs.get(jobId)
  if (!job) return { error: `Job "${jobId}" not found` }

  const patch = params.patch as Record<string, unknown> | undefined
  if (!patch || Object.keys(patch).length === 0) return { error: 'patch is required' }

  if (patch.name !== undefined) job.name = patch.name as string
  if (patch.prompt !== undefined) job.prompt = patch.prompt as string
  if (patch.agentId !== undefined) job.agentId = patch.agentId as string | undefined
  if (patch.model !== undefined) job.model = patch.model as string | undefined
  if (patch.workingFolder !== undefined) job.workingFolder = patch.workingFolder as string | undefined
  if (patch.enabled !== undefined) job.enabled = patch.enabled as boolean
  if (patch.deleteAfterRun !== undefined) job.deleteAfterRun = patch.deleteAfterRun as boolean
  if (patch.maxIterations !== undefined) job.maxIterations = patch.maxIterations as number

  if (patch.schedule) {
    const schedErr = validateSchedule(patch.schedule as CronSchedule)
    if (schedErr) return { error: schedErr }
    job.schedule = patch.schedule as CronSchedule
  }

  job.updatedAt = Date.now()

  // Re-schedule
  clearJobTimers(jobId)
  if (job.enabled && !job.deletedAt) {
    const scheduled = scheduleJob(job)
    if (!scheduled) {
      return { error: `Failed to re-schedule job (kind=${job.schedule.kind})` }
    }
  }

  return { success: true, jobId }
}

export async function handleCronDelete(params: Record<string, unknown>): Promise<unknown> {
  const jobId = params.jobId as string | undefined
  if (!jobId) return { error: 'jobId is required' }

  const job = jobs.get(jobId)
  if (!job) return { error: `Job "${jobId}" not found` }

  clearJobTimers(jobId)
  job.deletedAt = Date.now()
  job.enabled = false

  return { success: true, jobId }
}

export async function handleCronList(params: Record<string, unknown>): Promise<unknown> {
  const sessionId = params?.sessionId as string | undefined
  const includeDeleted = params?.includeDeleted as boolean | undefined

  const result: CronJob[] = []
  for (const job of jobs.values()) {
    if (job.deletedAt && !includeDeleted) continue
    if (sessionId && job.sessionId !== sessionId) continue
    result.push({
      id: job.id,
      name: job.name,
      sessionId: job.sessionId,
      schedule: job.schedule,
      prompt: job.prompt,
      agentId: job.agentId,
      model: job.model,
      workingFolder: job.workingFolder,
      deliveryMode: job.deliveryMode,
      deliveryTarget: job.deliveryTarget,
      enabled: job.enabled,
      deleteAfterRun: job.deleteAfterRun,
      maxIterations: job.maxIterations,
      deletedAt: job.deletedAt,
      lastFiredAt: job.lastFiredAt,
      fireCount: job.fireCount,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    })
  }
  return result
}

/** Cron handler dispatch — maps method name to handler function */
export async function handleCronReverseRequest(
  method: string,
  params: unknown
): Promise<unknown> {
  const raw = (params as Record<string, unknown>) ?? {}
  // .NET executor sends { toolName, input: {...tool params...}, parameters }
  // Extract the actual tool input from the nested `input` field
  const args = (raw.input as Record<string, unknown>) ?? raw
  switch (method) {
    case 'cron:add':
      return handleCronAdd(args)
    case 'cron:update':
      return handleCronUpdate(args)
    case 'cron:delete':
      return handleCronDelete(args)
    case 'cron:list':
      return handleCronList(args)
    default:
      return { error: `Unknown cron method: ${method}` }
  }
}
