/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

import { createIpcStateStorage } from './ipc-state-storage'

/**
 * Custom Zustand StateStorage that delegates to main process settings.json
 * via IPC, replacing localStorage.
 */
export const ipcStorage = createIpcStateStorage({
  getChannel: 'settings:get',
  setChannel: 'settings:set'
})
