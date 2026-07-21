import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Code, Lightbulb, FileText } from 'lucide-react'
import { useChatStore } from '@renderer/stores/chat-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useChatActions } from '@renderer/hooks/use-chat-actions'
import { ModelSwitcher } from './ModelSwitcher'
import { cn } from '@renderer/lib/utils'

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
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content) return

    // Create a new session
    const sessionId = createSession('chat', null, { preserveProjectless: true })
    setInput('')
    navigateToSession(sessionId)

    // Send the message
    await sendMessage(content, undefined, undefined, sessionId)
  }, [input, createSession, navigateToSession, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-4">
      <div className="w-full max-w-2xl">
        {/* Hero */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">
            {t('home.title', { defaultValue: 'How can I help you today?' })}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('home.subtitle', { defaultValue: 'Start a conversation or pick a quick prompt below.' })}
          </p>
        </div>

        {/* Input area */}
        <div className="mb-6">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-background p-3 shadow-sm">
            <ModelSwitcher />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('home.placeholder', { defaultValue: 'Type your message...' })}
              rows={1}
              className={cn(
                'flex-1 resize-none bg-transparent px-2 py-2 text-sm',
                'placeholder:text-muted-foreground focus:outline-none',
                'max-h-[200px]'
              )}
              style={{ minHeight: '40px' }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('home.send', { defaultValue: 'Send' })}
            </button>
          </div>
        </div>

        {/* Quick prompts */}
        <div className="grid grid-cols-2 gap-2">
          {QUICK_PROMPTS.map((prompt) => {
            const Icon = prompt.icon
            return (
              <button
                key={prompt.label}
                onClick={() => {
                  setInput(prompt.prompt)
                  textareaRef.current?.focus()
                }}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2.5 text-left text-xs transition-colors hover:border-border hover:bg-accent/40"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{prompt.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
