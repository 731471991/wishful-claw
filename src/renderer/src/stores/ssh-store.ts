// Compatibility shim — the SSH store now lives in ./ssh as domain slices
// (connections / sessions / explorer / sftp / transfers / ui). Import paths
// are preserved; new code can import from '@renderer/stores/ssh/store'.
export * from './ssh/types'
export { useSshStore, type SshStore } from './ssh/store'
