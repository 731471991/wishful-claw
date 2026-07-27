import { randomUUID } from 'crypto'
import { registerMessagePackHandler } from './messagepack-handler'
import {
  initializeSshRepository,
  listConnections,
  getConnectionMeta,
  getConnectionWithSecrets,
  createConnection,
  updateConnection,
  deleteConnection,
  type SshConnectionMeta,
  type SshConnectionInput,
  type SshConnectionPatch
} from '../ssh/repository'
import { execSshCommand, testSshConnection, type SshExecResult } from '../ssh/ssh-exec'
import { closeAllSshConnections } from '../ssh/connection-pool'

// SSH IPC handlers: connection CRUD + exec.

let sshInitialized = false

async function ensureSshInitialized(): Promise<void> {
  if (sshInitialized) return
  sshInitialized = true
  try {
    await initializeSshRepository()
    console.log('[SSH Handlers] Repository initialized')
  } catch (err) {
    console.warn('[SSH Handlers] Repository initialization failed:', err)
    sshInitialized = false
    throw err
  }
}

function toMeta(meta: SshConnectionMeta): Record<string, unknown> {
  return {
    id: meta.id,
    groupId: meta.groupId,
    name: meta.name,
    host: meta.host,
    port: meta.port,
    username: meta.username,
    authType: meta.authType,
    privateKeyPath: meta.privateKeyPath,
    startupCommand: meta.startupCommand,
    defaultDirectory: meta.defaultDirectory,
    keepAliveInterval: meta.keepAliveInterval,
    sortOrder: meta.sortOrder,
    lastConnectedAt: meta.lastConnectedAt,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    hasPassword: meta.hasPassword,
    hasPassphrase: meta.hasPassphrase
  }
}

export function registerSshHandlers(): void {
  // ── Connection CRUD ──

  registerMessagePackHandler('ssh:connection:list', async () => {
    await ensureSshInitialized()
    return listConnections().map(toMeta)
  })

  registerMessagePackHandler('ssh:connection:create', async (args) => {
    await ensureSshInitialized()
    const input = args as SshConnectionInput
    if (!input.id) input.id = randomUUID()
    await createConnection(input)
    const meta = getConnectionMeta(input.id)
    return meta ? toMeta(meta) : null
  })

  registerMessagePackHandler('ssh:connection:update', async (args) => {
    await ensureSshInitialized()
    const { id, ...patch } = args as { id: string } & SshConnectionPatch
    await updateConnection(id, patch)
    const meta = getConnectionMeta(id)
    return meta ? toMeta(meta) : null
  })

  registerMessagePackHandler('ssh:connection:delete', async (args) => {
    await ensureSshInitialized()
    const { id } = args as { id: string }
    await deleteConnection(id)
    return { success: true }
  })

  registerMessagePackHandler('ssh:connection:test', async (args) => {
    await ensureSshInitialized()
    const { id } = args as { id: string }
    const result = await testSshConnection(id)
    return result
  })

  // ── Exec ──

  registerMessagePackHandler('ssh:exec', async (args) => {
    await ensureSshInitialized()
    const { connectionId, command, timeoutMs } = args as {
      connectionId: string
      command: string
      timeoutMs?: number
    }
    if (!connectionId || !command) {
      return {
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'connectionId and command are required',
        error: 'connectionId and command are required'
      } as SshExecResult
    }
    return await execSshCommand(connectionId, command, timeoutMs ?? 60_000)
  })

  // ── Connect / Disconnect ──

  registerMessagePackHandler('ssh:connect', async (args) => {
    await ensureSshInitialized()
    const { connectionId } = args as { connectionId: string }
    const result = await testSshConnection(connectionId)
    return result
  })

  registerMessagePackHandler('ssh:disconnect', async (args) => {
    const { connectionId } = args as { connectionId: string }
    // The connection manager auto-closes idle connections after LINGER_MS.
    // For explicit disconnect, we just close the handle.
    // This is handled by the linger mechanism for now.
    return { success: true }
  })

  // ── Session list (stub — no terminal sessions in this version) ──

  registerMessagePackHandler('ssh:session:list', async () => {
    return []
  })
}

export function cleanupSshHandlers(): void {
  closeAllSshConnections()
}
