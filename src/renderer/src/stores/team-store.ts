import { create } from 'zustand'

export interface ActiveTeam {
  id: string
  name: string
  members: { id: string; name: string; role: string }[]
}

interface TeamStore {
  activeTeam: ActiveTeam | null
  setActiveTeam: (team: ActiveTeam | null) => void
}

export const useTeamStore = create<TeamStore>((set) => ({
  activeTeam: null,
  setActiveTeam: (team) => set({ activeTeam: team })
}))
