import { useRef, useEffect } from 'react'
import type { InputDraftValue } from '@renderer/lib/input-drafts'

interface DraftContext {
  [key: string]: unknown
}

interface UseInputDraftPersistenceResult {
  hydrated: boolean
  loadedDraft: InputDraftValue | null
  saveDraft: (draft: InputDraftValue) => void
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
    saveDraft: (_draft: InputDraftValue) => {},
    removeDraft: () => {}
  }
}
