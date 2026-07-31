import { registerMessagePackHandler } from './messagepack-handler'
import { getNativeWorker } from '../lib/native-worker'

/**
 * Register sidecar and agent IPC handlers that agentBridge (renderer) depends on.
 * These forward to the native worker via the same named-pipe IPC as worker:request.
 *
 * The normal chat path uses window.api.workerRequest() directly, but features ported
 * from WishfulClaw (prompt optimizer, context compression, translate, etc.) use
 * agentBridge which calls sidecar:* and agent:* channels.
 */
export function registerSidecarHandlers(): void {
  // ── Sidecar lifecycle ──

  registerMessagePackHandler<unknown, { ok: boolean; pid?: number }>(
    'sidecar:start',
    async () => {
      const worker = getNativeWorker()
      await worker.ensureStarted()
      const result = await worker.request<{ ok?: boolean; pid?: number }>('initialize', {})
      return { ok: result.ok ?? true, pid: result.pid ?? worker.processId ?? undefined }
    }
  )

  registerMessagePackHandler<unknown, { running: boolean }>(
    'sidecar:status',
    async () => {
      const worker = getNativeWorker()
      return { running: worker.isRunning }
    }
  )

  registerMessagePackHandler<unknown, { ok: boolean }>(
    'sidecar:stop',
    async () => {
      // Worker lifecycle is managed by the main process; renderer stop is a no-op.
      // The worker stays alive for other potential consumers.
      return { ok: true }
    }
  )

  registerMessagePackHandler<unknown, { ok: boolean }>(
    'sidecar:recycle',
    async () => {
      // Recycle: just ensure started. True restart would require killing and
      // respawning the process, which is handled by ensureStarted if the
      // process has died.
      const worker = getNativeWorker()
      if (!worker.isRunning) {
        await worker.ensureStarted()
      }
      return { ok: true }
    }
  )

  registerMessagePackHandler<unknown, boolean>(
    'sidecar:can-handle',
    async (args) => {
      // args can be a raw string (from canSidecarHandle) or an object
      const capability = typeof args === 'string' ? args : undefined
      if (!capability) return false

      const worker = getNativeWorker()
      if (!worker.isRunning) return false

      // Known capabilities
      if (capability === 'agent.run') return true

      // Provider capability check: provider.openai-chat, provider.anthropic, etc.
      if (capability.startsWith('provider.')) {
        const providerType = capability.slice('provider.'.length)
        // AgentLoop supports openai-chat and anthropic (see AgentLoop.cs)
        return providerType === 'openai-chat' || providerType === 'anthropic'
      }

      return false
    }
  )

  // ── Sidecar generic request forwarder ──

  registerMessagePackHandler<{ method: string; params?: unknown; timeoutMs?: number }, unknown>(
    'sidecar:request',
    async (args) => {
      const worker = getNativeWorker()
      return worker.request(args.method, args.params ?? {}, args.timeoutMs)
    }
  )

  // ── Agent run / cancel / stop / append ──

  registerMessagePackHandler<unknown, { started: boolean; runId: string }>(
    'agent:run',
    async (params) => {
      const worker = getNativeWorker()
      return worker.request<{ started: boolean; runId: string }>('agent/run', params)
    }
  )

  registerMessagePackHandler<{ runId: string }, { cancelled: boolean; runId?: string }>(
    'agent:cancel',
    async (args) => {
      const worker = getNativeWorker()
      return worker.request<{ cancelled: boolean; runId?: string }>('agent/cancel', { runId: args.runId })
    }
  )

  registerMessagePackHandler<{ runId: string }, { stopped: boolean; runId?: string }>(
    'agent:request-stop',
    async (args) => {
      const worker = getNativeWorker()
      return worker.request<{ stopped: boolean; runId?: string }>('agent/request-stop', { runId: args.runId })
    }
  )

  registerMessagePackHandler<{ runId: string; messages: unknown[] }, { appended: boolean; runId?: string; count: number }>(
    'agent:append-messages',
    async (args) => {
      const worker = getNativeWorker()
      return worker.request<{ appended: boolean; runId?: string; count: number }>(
        'agent/append-messages',
        { runId: args.runId, messages: args.messages }
      )
    }
  )
}
