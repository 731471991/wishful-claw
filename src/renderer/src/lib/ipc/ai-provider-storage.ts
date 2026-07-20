import { createIpcStateStorage } from './ipc-state-storage'

/**
 * Zustand storage for provider state. The main process persists this into
 * ~/.wishful-claw/ai-provider/index.json and one JSON file per provider.
 */
export const aiProviderStorage = createIpcStateStorage({
  getChannel: 'ai-provider:get',
  setChannel: 'ai-provider:set'
})
