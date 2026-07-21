import { create } from 'zustand'

interface AppPluginStore {
  enabledPlugins: string[]
  resolvePluginsForProject: (_projectId?: string | null) => string[]
}

export const useAppPluginStore = create<AppPluginStore>((set) => ({
  enabledPlugins: [],
  resolvePluginsForProject: () => []
}))

export function resolvePluginsForProject(_projectId?: string | null): string[] {
  return []
}
