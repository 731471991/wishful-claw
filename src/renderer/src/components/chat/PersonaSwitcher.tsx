import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { usePersonaStore } from '@renderer/stores/persona-store'
import { useChatStore } from '@renderer/stores/chat-store'
import { dbUpdateSession } from '@renderer/stores/chat-store/db-helpers'
import { useSettingsStore } from '@renderer/stores/settings-store'

interface PersonaSwitcherProps {
  sessionId: string
  workingFolder?: string
}

/**
 * Compact persona selector for the chat input area.
 * Shows current persona name, click to open a dropdown list.
 * Switching updates session.personaId and persists to DB.
 */
export function PersonaSwitcher({ sessionId, workingFolder }: PersonaSwitcherProps) {
  const { t } = useTranslation()
  const { personas, listPersonas } = usePersonaStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const session = useChatStore((s) => s.sessions.find((sess) => sess.id === sessionId))
  const settings = useSettingsStore()
  const currentPersonaId = session?.personaId ?? settings.defaultPersonaId

  useEffect(() => {
    listPersonas(workingFolder)
  }, [workingFolder, listPersonas])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const currentPersona = personas.find((p) => p.id === currentPersonaId)

  const handleSelect = async (personaId: string) => {
    setOpen(false)

    // Update session in store (immer)
    useChatStore.setState((state) => {
      const idx = state.sessions.findIndex((s) => s.id === sessionId)
      if (idx >= 0) {
        state.sessions[idx].personaId = personaId
      }
    })

    // Persist to DB
    try {
      await dbUpdateSession(sessionId, { personaId })
    } catch (err) {
      console.error('[PersonaSwitcher] Failed to update session persona:', err)
    }
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        title={t('chat.personaSwitcher.title')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span className="max-w-[80px] truncate">
          {currentPersona?.name ?? t('chat.personaSwitcher.none')}
        </span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 max-h-60 w-48 overflow-y-auto rounded-md border border-white/10 bg-[var(--bg-color,#1e1e1e)] py-1 shadow-xl">
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className={`flex w-full flex-col items-start px-3 py-1.5 text-left text-xs transition-colors hover:bg-white/5 ${
                p.id === currentPersonaId ? 'text-blue-400' : 'text-white/70'
              }`}
            >
              <span className="font-medium">{p.name}</span>
              {p.tagline && (
                <span className="text-[10px] text-white/40">{p.tagline}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
