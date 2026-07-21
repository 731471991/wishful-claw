import { createIpcStateStorage } from '@renderer/lib/ipc/ipc-state-storage'

export const settingsStorage = createIpcStateStorage({
  getChannel: 'settings:get',
  setChannel: 'settings:set'
})
