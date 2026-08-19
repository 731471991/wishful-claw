/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

// Compatibility shim — the SSH store now lives in ./ssh as domain slices
// (connections / sessions / explorer / sftp / transfers / ui). Import paths
// are preserved; new code can import from '@renderer/stores/ssh/store'.
export * from './ssh/types'
export { useSshStore, type SshStore } from './ssh/store'
