// Stub: pet-exp-store (to be filled when pet features are migrated)

interface PetExpState {
  totalExp?: number
  [key: string]: unknown
}

export const usePetExpStoreStore = {
  getState: (): PetExpState => ({ totalExp: 0 }),
  subscribe: () => () => {},
}

// Alias for compatibility
export const usePetExpStore = usePetExpStoreStore
