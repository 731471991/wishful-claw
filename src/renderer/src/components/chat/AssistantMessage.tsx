import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@renderer/stores/chat-store'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export function AssistantMessage({ message }: { message: ChatMessage }) {
  const [showThinking, setShowThinking] = useState(false)
  const hasThinking = !!(message.thinking && message.thinking.length > 0)

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        {/* Thinking section (collapsible) */}
        {hasThinking && (
          <div className="rounded-lg border border-border bg-muted/30">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="flex w-full items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showThinking ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              <span>Thinking{message.isStreaming ? '...' : ''}</span>
            </button>
            {showThinking && (
              <div className="px-3 pb-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                {message.thinking}
              </div>
            )}
          </div>
        )}

        {/* Main content */}
        <div className="rounded-2xl bg-muted px-4 py-2">
          {message.text ? (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.text}
              </ReactMarkdown>
            </div>
          ) : message.isStreaming ? (
            <div className="flex items-center gap-1 py-1">
              <span className="text-sm text-muted-foreground">Generating</span>
              <span className="inline-flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          ) : null}

          {/* Streaming cursor */}
          {message.isStreaming && message.text && (
            <span className={cn('inline-block h-3.5 w-0.5 animate-pulse bg-foreground/60 ml-0.5 align-text-bottom')} />
          )}
        </div>

        {/* Error */}
        {message.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
            {message.error}
          </div>
        )}

        {/* Usage info */}
        {message.usage && !message.isStreaming && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            {message.usage.inputTokens > 0 && <span>in: {message.usage.inputTokens}</span>}
            {message.usage.outputTokens > 0 && <span>out: {message.usage.outputTokens}</span>}
            {message.timing && <span>{(message.timing.totalMs / 1000).toFixed(1)}s</span>}
            {message.timing?.tps && <span>{message.timing.tps.toFixed(1)} tok/s</span>}
          </div>
        )}
      </div>
    </div>
  )
}
