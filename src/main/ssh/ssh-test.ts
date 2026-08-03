import { Client } from 'ssh2'
import { getConnectionWithSecrets } from './repository'
import { buildConnectConfig, errorMessage } from './auth'

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
    return { success: false, error: 'Connection not found' }
  }

  let config
  try {
    // No keepalive for a one-shot test
    config = await buildConnectConfig({
      ...connection,
      keepAliveInterval: 0
    })
    // Remove keepalive settings for test connection
    delete config.keepaliveInterval
    delete config.keepaliveCountMax
  } catch (err) {
    return { success: false, error: errorMessage(err) }
  }

  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    const client = new Client()
    let settled = false

    const finish = (success: boolean, error?: string): void => {
      if (settled) return
      settled = true
      // Always destroy the client — no lingering connections
      try { client.end() } catch { /* ignore */ }
      try { client.destroy() } catch { /* ignore */ }
      resolve({ success, error })
    }

    // Timeout: 15s for a test connection (shorter than exec's 30s)
    const timer = setTimeout(() => {
      finish(false, 'Connection timed out (15s)')
    }, 15_000)

    client.on('ready', () => {
      clearTimeout(timer)
      // SSH handshake + auth succeeded — no need to exec anything
      finish(true)
    })

    client.on('error', (err: Error) => {
      clearTimeout(timer)
      finish(false, errorMessage(err))
    })

    // If the server closes the connection before we get 'ready',
    // treat it as a failure
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

    try {
      client.connect(config)
    } catch (err) {
      clearTimeout(timer)
      finish(false, errorMessage(err))
    }
  })
}
