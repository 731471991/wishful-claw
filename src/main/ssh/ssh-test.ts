import { Client } from 'ssh2'
import { getConnectionWithSecrets } from './repository'
import { buildConnectConfig, errorMessage } from './auth'
import { logInfo, logWarn, logError } from '../lib/logger'

/**
 * Test SSH connection with a one-shot ssh2 Client.
 *
 * Does NOT use the connection pool — no reconnect, no retry, no keepalive.
 * Creates a single connection, verifies the SSH handshake + auth, then
 * immediately destroys the client.
 *
 * This is separate from execSshCommand (which uses the pool) to avoid
 * triggering brute-force detection on the remote server when a user
 * just wants to verify their credentials.
 */
export async function testSshConnection(
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  const connection = getConnectionWithSecrets(connectionId)
  if (!connection) {
    logWarn('main', `[SSH Test] Connection not found: ${connectionId}`)
    return { success: false, error: 'Connection not found' }
  }

  logInfo('main', `[SSH Test] Starting test for "${connection.name}"`, {
    extra: {
      connectionId,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      authType: connection.authType,
      hasPassword: !!connection.password,
      hasPassphrase: !!connection.passphrase,
      privateKeyPath: connection.privateKeyPath,
      encryptedPasswordLength: connection.password?.length ?? 0
    }
  })

  let config
  try {
    config = await buildConnectConfig({
      ...connection,
      keepAliveInterval: 0
    })
    delete config.keepaliveInterval
    delete config.keepaliveCountMax

    logInfo('main', `[SSH Test] Connect config built`, {
      extra: {
        host: config.host,
        port: config.port,
        username: config.username,
        hasPasswordInConfig: !!config.password,
        hasPrivateKeyInConfig: !!config.privateKey,
        readyTimeout: config.readyTimeout
      }
    })
  } catch (err) {
    const msg = errorMessage(err)
    logError('main', `[SSH Test] Failed to build connect config: ${msg}`, {
      stack: err instanceof Error ? err.stack : undefined
    })
    return { success: false, error: msg }
  }

  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    const client = new Client()
    let settled = false

    const finish = (success: boolean, error?: string): void => {
      if (settled) return
      settled = true
      try { client.end() } catch { /* ignore */ }
      try { client.destroy() } catch { /* ignore */ }

      if (success) {
        logInfo('main', `[SSH Test] SUCCESS for "${connection.name}"`)
      } else {
        logWarn('main', `[SSH Test] FAILED for "${connection.name}": ${error}`)
      }
      resolve({ success, error })
    }

    const timer = setTimeout(() => {
      finish(false, 'Connection timed out (15s)')
    }, 15_000)

    client.on('ready', () => {
      clearTimeout(timer)
      finish(true)
    })

    client.on('error', (err: Error) => {
      clearTimeout(timer)
      logError('main', `[SSH Test] ssh2 client error: ${err.message}`, {
        stack: err.stack,
        extra: { errName: err.constructor.name, errMsg: err.message }
      })
      finish(false, errorMessage(err))
    })

    client.on('close', () => {
      if (!settled) {
        clearTimeout(timer)
        finish(false, 'Connection closed by server before authentication completed')
      }
    })

    client.on('end', () => {
      if (!settled) {
        clearTimeout(timer)
        finish(false, 'Connection ended by server before authentication completed')
      }
    })

    // Enable ssh2 debug output for test connections
    config.debug = (msg: string): void => {
      logInfo('main', `[SSH Test] ssh2: ${msg}`)
    }

    try {
      logInfo('main', `[SSH Test] Connecting to ${connection.host}:${connection.port}...`)
      client.connect(config)
    } catch (err) {
      clearTimeout(timer)
      const msg = errorMessage(err)
      logError('main', `[SSH Test] client.connect() threw: ${msg}`)
      finish(false, msg)
    }
  })
}
