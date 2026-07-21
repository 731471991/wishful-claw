import { create } from 'zustand'

interface SkillsStore {
  skills: { id: string; name: string; description?: string }[]
}

export const useSkillsStore = create<SkillsStore>(() => ({
  skills: []
}))
