import { useState, useCallback } from 'react'
import { useChatStore } from '@renderer/stores/chat-store'

let _floatingSessionId: string | null = null

/**
 * Hook to manage the floating chat session for skill installation.
 * Session is created lazily — only when the user actually sends the first message.
 * Reuses the same session across subsequent opens.
 */
export function useFloatingChatSession(): {
  sessionId: string | null
  open: () => void
  close: () => void
  isOpen: boolean
  ensureSession: () => string
} {
  const [isOpen, setIsOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(_floatingSessionId)

  const ensureSession = useCallback(() => {
    if (!_floatingSessionId) {
      const id = useChatStore.getState().createSession('chat', null, {
        preserveProjectless: true
      })
      useChatStore.getState().updateSessionTitle(id, 'Skill Installer')
      _floatingSessionId = id
    }
    setSessionId(_floatingSessionId)
    return _floatingSessionId
  }, [])

  const open = useCallback(() => {
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  return { sessionId, open, close, isOpen, ensureSession }
}
