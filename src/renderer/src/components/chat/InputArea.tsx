import { useState, useRef, useEffect } from 'react'
import { Send, Square } from 'lucide-react'
import { useChatStore } from '@renderer/stores/chat-store'
import { useActivityStore } from '@renderer/stores/activity-store'
import { useChatActions } from '@renderer/hooks/use-chat-actions'
import { ModelSwitcher } from './ModelSwitcher'
import { cn } from '@renderer/lib/utils'

interface InputAreaProps {
  /** Override send handler (used by ChatHomePage / SessionConversationPane) */
  onSend?: (text: string) => void
  /** Override streaming state */
  isStreaming?: boolean
  /** Override stop handler */
  onStop?: () => void
  /** Session ID for context */
  sessionId?: string | null
  /** Working folder to display */
  workingFolder?: string
  /** Hide working folder indicator */
  hideWorkingFolderIndicator?: boolean
  /** Attached to bottom (no bottom padding) */
  attachedFooter?: boolean
}

export function InputArea({
  onSend: onSendOverride,
  isStreaming: isStreamingOverride,
  onStop: onStopOverride,
  sessionId,
  attachedFooter
}: InputAreaProps = {}): React.JSX.Element {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const storeIsStreaming = useChatStore((s) =>
    sessionId ? Boolean(s.streamingMessages[sessionId]) : !!s.streamingMessageId
  )
  const { sendMessage, stopStreaming } = useChatActions()
  const clearActivities = useActivityStore((s) => s.clearActivities)

  const isStreaming = isStreamingOverride ?? storeIsStreaming

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const handleSubmit = async () => {
    if (!input.trim() || isStreaming) return

    const text = input.trim()
    setInput('')
    clearActivities()

    if (onSendOverride) {
      onSendOverride(text)
    } else {
      await sendMessage(text, undefined, undefined, sessionId ?? undefined)
    }
  }

  const handleStop = () => {
    if (onStopOverride) {
      onStopOverride()
    } else {
      void stopStreaming()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div className={cn('px-4', attachedFooter ? 'pb-0' : 'pb-4')}>
      <div className="mx-auto max-w-3xl">
        {/* Composer shell */}
        <div className="composer-shell relative flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-[box-shadow,border-color] duration-200 focus-within:ring-1 focus-within:ring-ring">
          {/* Text input area */}
          <div className="px-3 pt-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className={cn(
                'w-full resize-none bg-transparent text-sm',
                'placeholder:text-muted-foreground focus:outline-none',
                'max-h-[200px] min-h-[40px]'
              )}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="composer-toolbar relative z-20 mt-1 flex shrink-0 items-center justify-between gap-2 px-2 pb-2">
            {/* Left: Model switcher */}
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <ModelSwitcher />
            </div>

            {/* Right: Send / Stop */}
            <div className="flex shrink-0 items-center gap-1.5">
              {isStreaming ? (
                <button
                  onClick={handleStop}
                  className="flex size-8 items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
                  title="Stop"
                >
                  <Square className="size-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!input.trim()}
                  className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Send"
                >
                  <Send className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
