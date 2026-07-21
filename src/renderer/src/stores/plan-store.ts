import { create } from 'zustand'

export type PlanStatus = 'draft' | 'approved' | 'executing' | 'completed' | 'rejected'

export interface Plan {
  id: string
  title: string
  steps: { id: string; description: string; status: string }[]
  status: PlanStatus
}

interface PlanStore {
  plansBySession: Record<string, Plan | null>
  setPlan: (sessionId: string, plan: Plan | null) => void
}

export const usePlanStore = create<PlanStore>((set) => ({
  plansBySession: {},
  setPlan: (sessionId, plan) =>
    set((state) => ({
      plansBySession: { ...state.plansBySession, [sessionId]: plan }
    }))
}))
