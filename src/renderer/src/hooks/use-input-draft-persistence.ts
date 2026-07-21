import { useRef, useEffect } from 'react'

export function useInputDraftPersistence(_sessionId: string | null) {
  const textRef = useRef('')
  return {
    textRef,
    saveDraft: () => {},
    loadDraft: () => '',
  }
}
