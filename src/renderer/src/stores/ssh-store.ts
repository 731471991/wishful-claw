import { create } from 'zustand'

interface SshStore {
  connections: { id: string; host: string; name: string }[]
}

export const useSshStore = create<SshStore>(() => ({
  connections: []
}))
