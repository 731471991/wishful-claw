import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { usePersonaStore } from '@renderer/stores/persona-store'
import { useChatStore } from '@renderer/stores/chat-store'
import { dbUpdateSession } from '@renderer/stores/chat-store/db-helpers'
import { useSettingsStore } from '@renderer/stores/settings-store'
import {
  Popover, PopoverContent, PopoverTrigger
} from '@renderer/components/ui/popover'
import { cn } from '@renderer/lib/utils'

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
  const session = useChatStore((s) => s.sessions.find((sess) => sess.id === sessionId))
  const settings = useSettingsStore()
  const currentPersonaId = session?.personaId ?? settings.defaultPersonaId

  useEffect(() => {
    listPersonas(workingFolder)
  }, [workingFolder, listPersonas])

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
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
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={4}
        className="max-h-60 w-48 overflow-y-auto p-1"
      >
        {personas.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            {t('chat.personaSwitcher.empty', { defaultValue: 'No personas available' })}
          </div>
        ) : (
          personas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p.id)}
              className={cn(
                'flex w-full flex-col items-start rounded px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted/50',
                p.id === currentPersonaId
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground'
              )}
            >
              <span className="font-medium">{p.name}</span>
              {p.tagline && (
                <span className="text-[10px] text-muted-foreground/60">{p.tagline}</span>
              )}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  )
}
