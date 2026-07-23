// Stub: pet-store (to be filled when pet features are migrated)

interface PetState {
  name?: string
  hunger?: number
  cleanliness?: number
  mood?: number
  growth?: number
  proactiveCountToday?: number
  [key: string]: unknown
}

export const usePetStoreStore = {
  getState: (): PetState => ({}),
  subscribe: () => () => {},
}

// Alias for compatibility
export const usePetStore = usePetStoreStore

export function getPetLevel(_totalExp: number): number {
  return 1
}

export function localDateKey(_date?: Date): string {
  return new Date().toISOString().slice(0, 10)
}

export function getProactiveCountToday(): number {
  return 0
}
