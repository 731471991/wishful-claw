import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const DATA_DIRECTORY_NAME = '.wishful-claw'
const SETTINGS_DIRECTORY_NAME = 'settings'
const SETTINGS_FILE_NAME = 'general.json'

export const SETTINGS_STORAGE_KEY = 'wishful-claw-settings'

function getDefaultDataDirectory(): string {
  return path.join(os.homedir(), DATA_DIRECTORY_NAME)
}

function getSettingsFilePath(dataDirectory = getDefaultDataDirectory()): string {
  return path.join(dataDirectory, SETTINGS_DIRECTORY_NAME, SETTINGS_FILE_NAME)
}

export function readPersistedSettings(): Record<string, unknown> | null {
  const filePath = getSettingsFilePath()
  try {
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

export function writePersistedSettings(value: unknown): void {
  const filePath = getSettingsFilePath()
  const directory = path.dirname(filePath)
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), {
    encoding: 'utf8',
    mode: 0o600
  })
}

export function clearPersistedSettings(): void {
  const filePath = getSettingsFilePath()
  try {
    fs.rmSync(filePath, { force: true })
  } catch {
    // ignore
  }
}
