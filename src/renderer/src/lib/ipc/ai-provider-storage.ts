/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

import { createIpcStateStorage } from '@renderer/lib/ipc/ipc-state-storage'

/**
 * Zustand storage for provider state. The main process persists this into
 * ~/.wishful-claw/ai-provider/index.json and one JSON file per provider.
 */
export const aiProviderStorage = createIpcStateStorage({
  getChannel: 'ai-provider:get',
  setChannel: 'ai-provider:set'
})
