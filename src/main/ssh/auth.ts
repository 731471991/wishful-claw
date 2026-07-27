import * as fs from 'fs'
import { Client, type ConnectConfig } from 'ssh2'
import { getConnectionWithSecrets, type SshConnectionWithSecrets } from './repository'

// Connection/auth building blocks: ssh2 connect config assembly.

export interface SshConnectLogger {
  (level: string, stage: string, message: string): void
}

export async function buildConnectConfig(
  connection: SshConnectionWithSecrets,
  onDebug?: (message: string) => void
): Promise<ConnectConfig> {
  if (!connection) throw new Error('Connection not found')

  const config: ConnectConfig = {
    host: connection.host,
    port: connection.port,
    username: connection.username,
    keepaliveInterval: (connection.keepAliveInterval ?? 60) * 1000,
    keepaliveCountMax: 3,
    readyTimeout: 30000
  }

  if (onDebug) config.debug = onDebug

  if (connection.authType === 'password') {
    if (!connection.password) {
      throw new Error('Password is required for password authentication')
    }
    config.password = connection.password
  } else if (connection.authType === 'privateKey') {
    if (!connection.privateKeyPath) {
      throw new Error('Private key path is required for private key authentication')
    }
    try {
      const stat = await fs.promises.stat(connection.privateKeyPath)
      if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
        console.warn(
          `[SSH] Private key ${connection.privateKeyPath} is readable by other users (mode ${(
            stat.mode & 0o777
          ).toString(8)})`
        )
      }
      config.privateKey = await fs.promises.readFile(connection.privateKeyPath, 'utf-8')
    } catch (err) {
      throw new Error(`Failed to read private key: ${err}`)
    }
    if (connection.passphrase) {
      config.passphrase = connection.passphrase
    }
  } else if (connection.authType === 'agent') {
    config.agent =
      process.platform === 'win32'
        ? '\\\\.\\pipe\\openssh-ssh-agent'
        : process.env.SSH_AUTH_SOCK || undefined
  } else {
    throw new Error(`Unsupported authentication type: ${connection.authType}`)
  }

  return config
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
