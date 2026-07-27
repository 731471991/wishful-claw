import { withSshConnection } from './connection-pool'
import { errorMessage } from './auth'

// SSH command execution and connection testing.
// Depends on connection-pool for long-lived connection reuse.

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

/**
 * Execute a non-interactive command on a remote SSH server.
 * Reuses a persistent connection from the pool.
 *
 * @param connectionId  Saved SSH connection ID
 * @param command       Shell command to execute
 * @param timeoutMs     Execution timeout (default 60s)
 * @param onOutput      Optional callback for real-time output chunks
 *                      (used by Agent terminal旁观 mode)
 */
export async function execSshCommand(
  connectionId: string,
  command: string,
  timeoutMs = 60_000,
  onOutput?: (chunk: { stream: 'stdout' | 'stderr'; data: string }) => void
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
          stream.on('data', (data: Buffer) => {
            append('out', data)
            onOutput?.({ stream: 'stdout', data: data.toString('utf-8') })
          })
          stream.stderr.on('data', (data: Buffer) => {
            append('err', data)
            onOutput?.({ stream: 'stderr', data: data.toString('utf-8') })
          })
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

/**
 * Test that a connection can be established.
 * Does not execute any command — just verifies the SSH handshake.
 */
export async function testSshConnection(
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await withSshConnection(connectionId, async () => undefined)
    return { success: true }
  } catch (err) {
    return { success: false, error: errorMessage(err) }
  }
}
