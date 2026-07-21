import { create } from 'zustand'

interface ExtensionStore {
  activeExtensionIds: string[]
}

export const useExtensionStore = create<ExtensionStore>(() => ({
  activeExtensionIds: []
}))

export function resolveEffectiveActiveExtensionIds(): string[] {
  return []
}
