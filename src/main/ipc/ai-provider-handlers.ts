import {
  AI_PROVIDER_STORAGE_KEY,
  clearPersistedProviderStore,
  readPersistedProviderStore,
  writePersistedProviderStore
} from '../lib/ai-provider-store'
import { registerMessagePackHandler } from './messagepack-handler'

type MutationResult = {
  success: boolean
  error?: string
}

function assertProviderStorageKey(key: string | undefined): void {
  if (key && key !== AI_PROVIDER_STORAGE_KEY) {
    throw new Error(`Unsupported AI provider storage key: ${key}`)
  }
}

export function registerAiProviderHandlers(): void {
  registerMessagePackHandler<string | undefined>('ai-provider:get', (key) => {
    assertProviderStorageKey(key)
    return readPersistedProviderStore()
  })

  registerMessagePackHandler<{ key: string; value: unknown }, MutationResult>(
    'ai-provider:set',
    ({ key, value }) => {
      assertProviderStorageKey(key)
      if (value === undefined || value === null) {
        clearPersistedProviderStore()
      } else {
        writePersistedProviderStore(value)
      }
      return { success: true }
    }
  )
}
