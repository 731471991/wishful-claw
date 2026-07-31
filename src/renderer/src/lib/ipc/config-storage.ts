import { createIpcStateStorage } from './ipc-state-storage'

/**
 * Custom Zustand StateStorage that delegates generic application state to
 * ~/.wishful-claw/config.json via IPC. Provider configurations use ai-provider-storage instead.
 */
export const configStorage = createIpcStateStorage({
  getChannel: 'config:get',
  setChannel: 'config:set'
})
