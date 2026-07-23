import { create } from 'zustand'

// ─── Simplified channel store ───
// From OpenCowork, reduced to just what ModelSwitcher needs:
// - channels list (always empty for now — no plugin system yet)
// - updateChannel (no-op stub)

interface PluginInstance {
  id: string
  type: string
  name: string
  enabled: boolean
  config: Record<string, string>
  createdAt: number
  providerId?: string | null
  model?: string | null
  projectId?: string | null
  tools?: Record<string, boolean>
}

interface ChannelStore {
  channels: PluginInstance[]
  loadChannels: () => Promise<void>
  toggleActiveChannel: (projectId: string, channelId: string) => void
  loadProviders: () => Promise<void>
  activeChannelIdsByProject: Record<string, string[]>
  selectedChannelId: string | null
  channelStatuses: Record<string, 'running' | 'stopped' | 'error'>

  updateChannel: (id: string, patch: Partial<PluginInstance>) => Promise<void>
  setSelectedChannel: (id: string | null) => void
}

export const useChannelStore = create<ChannelStore>((set) => ({
  channels: [],
  selectedChannelId: null,
  channelStatuses: {},

  updateChannel: async (id, patch) => {
    set((s) => ({
      channels: s.channels.map((p) => (p.id === id ? { ...p, ...patch } : p))
    }))
  },

  setSelectedChannel: (id) => set({ selectedChannelId: id }),

  loadChannels: async () => {},
  loadProviders: async () => {},
  toggleActiveChannel: (_projectId: string, _channelId: string) => {},
  activeChannelIdsByProject: {}
}))
