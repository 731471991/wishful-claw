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
  registerMessagePackHandler<string | undefined>('settings:get', () => {
    return readPersistedSettings()
  })

  registerMessagePackHandler<{ key: string; value: unknown }, MutationResult>(
    'settings:set',
    ({ value }) => {
      if (value === undefined || value === null) {
        clearPersistedSettings()
      } else {
        writePersistedSettings(value)
      }
      return { success: true }
    }
  )
}
