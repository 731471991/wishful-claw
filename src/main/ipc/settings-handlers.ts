import {
  readPersistedSettings,
  writePersistedSettings,
  clearPersistedSettings
} from '../lib/settings-store'
import { registerMessagePackHandler } from './messagepack-handler'

type MutationResult = {
  success: boolean
  error?: string
}

export function registerSettingsHandlers(): void {
  // Read a specific store's persisted state by key (name)
  registerMessagePackHandler<string, unknown | null>('settings:get', (key) => {
    return readPersistedSettings(key)
  })

  // Write a specific store's persisted state under its key
  registerMessagePackHandler<{ key: string; value: unknown }, MutationResult>(
    'settings:set',
    ({ key, value }) => {
      if (value === undefined || value === null) {
        clearPersistedSettings(key)
      } else {
        writePersistedSettings(value, key)
      }
      return { success: true }
    }
  )
}
