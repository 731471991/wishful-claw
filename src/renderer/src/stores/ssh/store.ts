/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

// Extracted from the former monolithic ssh-store.ts; behavior unchanged.
import { create } from 'zustand'
import { createConnectionsSlice, type SshConnectionsSlice } from './connections-slice'
import { createSessionsSlice, type SshSessionsSlice } from './sessions-slice'
import { createExplorerSlice, type SshExplorerSlice } from './explorer-slice'
import { createSftpSlice, type SshSftpSlice } from './sftp-slice'
import { createTransfersSlice, type SshTransfersSlice } from './transfers-slice'
import { createUiSlice, type SshUiSlice } from './ui-slice'

export type SshStore = SshConnectionsSlice &
  SshSessionsSlice &
  SshExplorerSlice &
  SshSftpSlice &
  SshTransfersSlice &
  SshUiSlice

export const useSshStore = create<SshStore>()((...args) => ({
  ...createConnectionsSlice(...args),
  ...createSessionsSlice(...args),
  ...createExplorerSlice(...args),
  ...createSftpSlice(...args),
  ...createTransfersSlice(...args),
  ...createUiSlice(...args)
}))
