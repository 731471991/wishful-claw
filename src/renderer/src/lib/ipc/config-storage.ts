/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

import { createIpcStateStorage } from './ipc-state-storage'

/**
 * Custom Zustand StateStorage that delegates generic application state to
 * ~/.wishful-claw/config.json via IPC. Provider configurations use ai-provider-storage instead.
 */
export const configStorage = createIpcStateStorage({
  getChannel: 'config:get',
  setChannel: 'config:set'
})
