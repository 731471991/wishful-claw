import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Code, Lightbulb, FileText } from 'lucide-react'
import { useChatStore } from '@renderer/stores/chat-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useChatActions } from '@renderer/hooks/use-chat-actions'
import { InputArea } from './InputArea'

interface QuickPrompt {
  icon: React.ComponentType<{ className?: string }>
  label: string
  prompt: string
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { icon: Code, label: 'Write code', prompt: 'Help me write a function that ' },
  { icon: Lightbulb, label: 'Brainstorm ideas', prompt: 'Let us brainstorm about ' },
  { icon: FileText, label: 'Explain concept', prompt: 'Can you explain what ' },
  { icon: Sparkles, label: 'Creative writing', prompt: 'Write a creative piece about ' }
]

export function ChatHomePage(): React.JSX.Element {
  const { t } = useTranslation('chat')
  const createSession = useChatStore((s) => s.createSession)
  const navigateToSession = useUIStore((s) => s.navigateToSession)
  const { sendMessage } = useChatActions()

  const handleSend = useCallback(async (text: string) => {
    const content = text.trim()
    if (!content) return

    const sessionId = createSession('chat', null, { preserveProjectless: true })
    navigateToSession(sessionId)
    await sendMessage(content, undefined, undefined, sessionId)
  }, [createSession, navigateToSession, sendMessage])

  const handleQuickPrompt = useCallback((prompt: string) => {
    const textarea = document.querySelector('textarea')
    if (textarea instanceof HTMLTextAreaElement) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value'
      )?.set
      nativeSetter?.call(textarea, prompt)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      textarea.focus()
    }
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-auto px-6 pb-14 pt-8">
        <div className="flex flex-1 items-start justify-center pt-8 lg:items-center lg:pt-0">
          <div className="w-full max-w-[760px]">
            {/* Hero */}
            <div className="mb-6 flex flex-col items-center gap-3 text-center sm:mb-7">
              <p className="max-w-[760px] text-[30px] font-semibold tracking-tight text-foreground/92 sm:text-[42px]">
                {t('home.title', { defaultValue: 'How can I help you today?' })}
              </p>
              <p className="max-w-[560px] text-sm leading-6 text-muted-foreground/72">
                {t('home.subtitle', { defaultValue: 'Start a conversation or pick a quick prompt below.' })}
              </p>
            </div>

            {/* Input area (composer shell) */}
            <InputArea
              sessionId={null}
              onSend={handleSend}
              isStreaming={false}
              attachedFooter
            />

            {/* Quick prompts */}
            <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
              {QUICK_PROMPTS.map((prompt) => {
                const Icon = prompt.icon
                return (
                  <button
                    key={prompt.label}
                    type="button"
                    className="rounded-md border border-border/60 bg-background/40 px-3 py-1.5 text-[11px] text-muted-foreground/72 transition-colors hover:bg-muted/40 hover:text-foreground"
                    onClick={() => handleQuickPrompt(prompt.prompt)}
                  >
                    {prompt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
