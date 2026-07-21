import { create } from 'zustand'

interface McpStore {
  configuredServerIds: string[]
}

export const useMcpStore = create<McpStore>(() => ({
  configuredServerIds: []
}))

export function resolveConfiguredActiveMcpIds(): string[] {
  return []
}
