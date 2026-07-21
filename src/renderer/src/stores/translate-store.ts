import { create } from 'zustand'

interface TranslateStore {
  isTranslating: boolean
}

export const useTranslateStore = create<TranslateStore>(() => ({
  isTranslating: false
}))
