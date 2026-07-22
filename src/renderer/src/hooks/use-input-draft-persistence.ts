import { useRef, useEffect } from 'react'

interface DraftContext {
  [key: string]: unknown
}

interface UseInputDraftPersistenceResult {
  hydrated: boolean
  loadedDraft: string | null
  saveDraft: (text: string) => void
  removeDraft: () => void
}

export function useInputDraftPersistence(_options: {
  draftKey: string
  context?: DraftContext
}): UseInputDraftPersistenceResult {
  const hydratedRef = useRef(false)

  useEffect(() => {
    hydratedRef.current = true
  }, [])

  return {
    hydrated: hydratedRef.current,
    loadedDraft: null,
    saveDraft: (_text: string) => {},
    removeDraft: () => {}
  }
}
