import { Client } from 'ssh2'
import { safeSendMessagePackToAllWindows } from '../window-ipc'
import { getConnectionWithSecrets, updateConnection } from './repository'
import { buildConnectConfig, errorMessage } from './auth'

// Connection runtime: one authenticated ssh2 Client per saved connection.
// Handles keepalive-detected drops with exponential-backoff reconnect.
// Only supports exec (non-interactive command execution).
// Terminal shells and SFTP are NOT included in this simplified version.

type HandleState = 'connecting' | 'ready' | 'reconnecting' | 'failed' | 'closed'

interface ConnectionHandle {
  connectionId: string
  state: HandleState
  client: Client | null
  lastError?: string
  generation: number
  reconnectAttempts: number
  reconnectTimer: NodeJS.Timeout | null
  lingerTimer: NodeJS.Timeout | null
  connectPromise: Promise<void> | null
  // Non-terminal consumers (exec ops) currently borrowing this handle.
  busyCount: number
}

const handles = new Map<string, ConnectionHandle>()

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 30000]
const MAX_RECONNECT_ATTEMPTS = 5
const LINGER_MS = 60_000

function currentState(handle: ConnectionHandle): HandleState {
  return handle.state
}

function acquireHandle(connectionId: string): ConnectionHandle {
  let handle = handles.get(connectionId)
  if (!handle) {
    handle = {
      connectionId,
      state: 'connecting',
      client: null,
      generation: 0,
      reconnectAttempts: 0,
      reconnectTimer: null,
      lingerTimer: null,
      connectPromise: null,
      busyCount: 0
    }
    handles.set(connectionId, handle)
  }
  return handle
}

function scheduleLingerIfIdle(handle: ConnectionHandle): void {
  if (handle.busyCount > 0) return
  if (handle.lingerTimer) return
  handle.lingerTimer = setTimeout(() => {
    handle.lingerTimer = null
    if (handle.busyCount > 0) return
    closeHandle(handle)
  }, LINGER_MS)
}

function closeHandle(handle: ConnectionHandle): void {
  handle.state = 'closed'
  if (handle.client) {
    try {
      handle.client.end()
    } catch {
      // ignore
    }
    handle.client = null
  }
  if (handle.reconnectTimer) {
    clearTimeout(handle.reconnectTimer)
    handle.reconnectTimer = null
  }
  handles.delete(handle.connectionId)
}

async function ensureConnected(handle: ConnectionHandle): Promise<Client> {
  // Already ready?
  if (currentState(handle) === 'ready' && handle.client) {
    return handle.client
  }

  // Already connecting?
  if (handle.connectPromise) {
    await handle.connectPromise
    if (handle.client && currentState(handle) === 'ready') return handle.client
    throw new Error(handle.lastError ?? 'Connection is not ready')
  }

  handle.state = 'connecting'
  handle.connectPromise = doConnect(handle)
  try {
    await handle.connectPromise
  } finally {
    handle.connectPromise = null
  }

  if (handle.client && currentState(handle) === 'ready') return handle.client
  throw new Error(handle.lastError ?? 'Connection failed')
}

async function doConnect(handle: ConnectionHandle): Promise<void> {
  const connection = getConnectionWithSecrets(handle.connectionId)
  if (!connection) throw new Error('Connection not found')

  const config = await buildConnectConfig(connection)

  return new Promise<void>((resolve) => {
    const client = new Client()
    let settled = false

    const generation = handle.generation + 1
    handle.generation = generation

    const finish = (err?: Error): void => {
      if (settled) return
      settled = true
      if (err) {
        handle.state = 'failed'
        handle.lastError = err.message
        handle.reconnectAttempts = 0
        scheduleReconnect(handle)
        resolve()
      } else {
        handle.state = 'ready'
        handle.lastError = undefined
        handle.reconnectAttempts = 0
        // Update lastConnectedAt
        void updateConnection(handle.connectionId, {
          lastConnectedAt: Date.now()
        })
        resolve()
      }
    }

    client.on('ready', () => {
      if (handle.generation !== generation) {
        try { client.end() } catch { /* ignore */ }
        return
      }
      handle.client = client

      client.on('error', (err) => {
        console.warn(`[SSH] Connection ${handle.connectionId} error:`, err.message)
      })

      client.on('close', () => {
        if (handle.generation !== generation) return
        if (currentState(handle) === 'closed') return
        console.warn(`[SSH] Connection ${handle.connectionId} closed unexpectedly`)
        handle.client = null
        handle.state = 'reconnecting'
        scheduleReconnect(handle)
      })

      client.on('end', () => {
        if (handle.generation !== generation) return
        if (currentState(handle) === 'closed') return
        handle.client = null
        handle.state = 'reconnecting'
        scheduleReconnect(handle)
      })

      finish()
    })

    client.on('error', (err) => {
      if (settled) {
        // Post-connect error
        console.warn(`[SSH] Connection ${handle.connectionId} error:`, err.message)
        return
      }
      finish(err)
    })

    client.connect(config)
  })
}

function scheduleReconnect(handle: ConnectionHandle): void {
  if (handle.reconnectTimer) return
  if (handle.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    handle.state = 'failed'
    handle.lastError = `Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) exceeded`
    return
  }

  const delay = RECONNECT_DELAYS_MS[Math.min(handle.reconnectAttempts, RECONNECT_DELAYS_MS.length - 1)]
  handle.reconnectAttempts += 1
  console.log(`[SSH] Scheduling reconnect for ${handle.connectionId} in ${delay}ms (attempt ${handle.reconnectAttempts})`)

  handle.reconnectTimer = setTimeout(() => {
    handle.reconnectTimer = null
    if (currentState(handle) === 'closed') return

    handle.state = 'reconnecting'
    handle.connectPromise = doConnect(handle)
    handle.connectPromise
      .catch((err) => {
        console.warn(`[SSH] Reconnect failed for ${handle.connectionId}:`, err.message)
      })
      .finally(() => {
        handle.connectPromise = null
      })
  }, delay)
}

// ── Public API ──

export async function withSshConnection<T>(
  connectionId: string,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  if (!getConnectionWithSecrets(connectionId)) {
    throw new Error('Connection not found')
  }
  const handle = acquireHandle(connectionId)
  handle.busyCount += 1

  // Cancel any pending linger timer
  if (handle.lingerTimer) {
    clearTimeout(handle.lingerTimer)
    handle.lingerTimer = null
  }

  try {
    await ensureConnected(handle)
    const client = handle.client
    if (!client) throw new Error(handle.lastError ?? 'Connection is not ready')
    return await fn(client)
  } finally {
    handle.busyCount -= 1
    scheduleLingerIfIdle(handle)
  }
}

// ── Exec ──

export interface SshExecResult {
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
  error?: string | null
  timing?: {
    totalMs: number
    spawnMs: number
    timedOut: boolean
    engine: string
  }
}

const MAX_EXEC_OUTPUT_BYTES = 1024 * 1024 // 1MB

export async function execSshCommand(
  connectionId: string,
  command: string,
  timeoutMs = 60_000
): Promise<SshExecResult> {
  const startedAt = Date.now()
  try {
    return await withSshConnection(connectionId, (client) => {
      return new Promise<SshExecResult>((resolve, reject) => {
        client.exec(command, (err, stream) => {
          if (err) return reject(err)
          let stdout = ''
          let stderr = ''
          let outputBytes = 0
          let timedOut = false
          const timer = setTimeout(() => {
            timedOut = true
            try { stream.close() } catch { /* ignore */ }
          }, timeoutMs)
          const append = (target: 'out' | 'err', data: Buffer): void => {
            if (outputBytes >= MAX_EXEC_OUTPUT_BYTES) return
            const text = data.toString('utf-8')
            outputBytes += data.length
            if (target === 'out') stdout += text
            else stderr += text
          }
          stream.on('data', (data: Buffer) => append('out', data))
          stream.stderr.on('data', (data: Buffer) => append('err', data))
          stream.on('close', (code: number | null) => {
            clearTimeout(timer)
            resolve({
              success: !timedOut,
              exitCode: timedOut ? 124 : (code ?? 0),
              stdout,
              stderr,
              error: timedOut ? `Command timed out after ${timeoutMs}ms` : undefined,
              timing: {
                totalMs: Date.now() - startedAt,
                spawnMs: 0,
                timedOut,
                engine: 'ssh2'
              }
            })
          })
          stream.on('error', (streamErr: Error) => {
            clearTimeout(timer)
            reject(streamErr)
          })
        })
      })
    })
  } catch (err) {
    const message = errorMessage(err)
    return {
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: message,
      error: message,
      timing: { totalMs: Date.now() - startedAt, spawnMs: 0, timedOut: false, engine: 'ssh2' }
    }
  }
}

export async function testSshConnection(connectionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await withSshConnection(connectionId, async () => undefined)
    return { success: true }
  } catch (err) {
    return { success: false, error: errorMessage(err) }
  }
}

export function closeAllSshConnections(): void {
  for (const handle of handles.values()) {
    closeHandle(handle)
  }
}
