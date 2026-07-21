import { useState, useRef, useEffect } from 'react'
import { Send, Square } from 'lucide-react'
import { useChatStore } from '@renderer/stores/chat-store'
import { useActivityStore } from '@renderer/stores/activity-store'
import { useChatActions } from '@renderer/hooks/use-chat-actions'
import { ModelSwitcher } from './ModelSwitcher'
import { cn } from '@renderer/lib/utils'

interface InputAreaProps {
  /** Override send handler (used by SessionConversationPane) */
  onSend?: (text: string) => void
  /** Override streaming state */
  isStreaming?: boolean
  /** Override stop handler */
  onStop?: () => void
  /** Session ID for context */
  sessionId?: string
}

export function InputArea({
  onSend: onSendOverride,
  isStreaming: isStreamingOverride,
  onStop: onStopOverride,
  sessionId
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
      await sendMessage(text, undefined, undefined, sessionId)
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
    <div className="border-t border-border px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2">
          <ModelSwitcher />

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className={cn(
                'w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm',
                'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
                'max-h-[200px]'
              )}
            />
          </div>

          {isStreaming ? (
            <button
              onClick={handleStop}
              className="rounded-xl bg-destructive p-2.5 text-destructive-foreground hover:bg-destructive/90 transition-colors"
              title="Stop"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => void handleSubmit()}
              disabled={!input.trim()}
              className="rounded-xl bg-primary p-2.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
