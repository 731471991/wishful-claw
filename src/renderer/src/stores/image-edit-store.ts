import { create } from 'zustand'

export type ImageEditMode = 'inpaint' | 'edit'

interface ImageEditStore {
  mode: ImageEditMode
  setMode: (mode: ImageEditMode) => void
}

export const useImageEditStore = create<ImageEditStore>((set) => ({
  mode: 'edit',
  setMode: (mode) => set({ mode })
}))
