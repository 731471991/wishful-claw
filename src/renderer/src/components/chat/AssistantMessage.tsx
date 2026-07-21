import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@renderer/stores/chat-store'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { ToolCallCard } from './ToolCallCard'
import { LazySyntaxHighlighter } from './LazySyntaxHighlighter'

const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'

const MARKDOWN_WRAPPER_CLASS = 'text-sm leading-relaxed text-foreground break-words'

const IsStreamingContext = React.createContext(false)

// ── CopyButton ──
function CopyButton({ text }: { text: string }): React.JSX.Element {
  const { t } = useTranslation('chat')
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? t('userMessage.copied', { defaultValue: 'Copied' }) : t('action.copy', { ns: 'common', defaultValue: 'Copy' })}
    </button>
  )
}

// ── PlainCodeBlock (used during streaming for performance) ──
function PlainCodeBlock({ language, code }: { language?: string; code: string }): React.JSX.Element {
  return (
    <div className="group relative rounded-lg border border-border/60 overflow-hidden my-3 shadow-sm">
      <div className="flex items-center justify-between bg-muted/40 px-3 py-1.5 border-b border-border/60">
        <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">
          {language || 'text'}
        </span>
        <CopyButton text={code} />
      </div>
      <pre
        className="text-xs"
        style={{
          margin: 0,
          padding: '14px',
          background: 'transparent',
          color: 'var(--foreground)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          fontFamily: MONO_FONT
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  )
}

// ── CodeBlock (with syntax highlighting) ──
function CodeBlock({
  language,
  children,
  isStreaming = false
}: {
  language?: string
  children: string
  isStreaming?: boolean
}): React.JSX.Element {
  const code = String(children).replace(/\n$/, '')
  if (isStreaming) {
    return <PlainCodeBlock language={language} code={code} />
  }
  return (
    <div className="group relative rounded-lg border border-border/60 overflow-hidden my-3 shadow-sm">
      <div className="flex items-center justify-between bg-muted/40 px-3 py-1.5 border-b border-border/60">
        <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">
          {language || 'text'}
        </span>
        <CopyButton text={code} />
      </div>
      <LazySyntaxHighlighter
        language={language || 'text'}
        customStyle={{
          margin: 0,
          padding: '14px',
          fontSize: '12px',
          lineHeight: '1.5',
          background: 'transparent',
          fontFamily: MONO_FONT,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}
        codeTagProps={{
          style: {
            fontFamily: 'inherit',
            fontSize: 'inherit'
          }
        }}
        className="!bg-[hsl(var(--muted))] text-xs"
      >
        {code}
      </LazySyntaxHighlighter>
    </div>
  )
}

// ── MarkdownCode (inline + block code renderer) ──
type MarkdownCodeElementProps = {
  position?: {
    start?: { line?: number }
    end?: { line?: number }
  }
}

function isMarkdownCodeBlock(rawCode: string, node?: MarkdownCodeElementProps): boolean {
  const startLine = node?.position?.start?.line
  const endLine = node?.position?.end?.line
  return (
    (typeof startLine === 'number' && typeof endLine === 'number' && startLine !== endLine) ||
    rawCode.includes('\n')
  )
}

const MarkdownCode: NonNullable<Components['code']> = ({ children, className, node, ...props }) => {
  const isStreaming = React.useContext(IsStreamingContext)
  const match = /language-([\w-]+)/.exec(className || '')
  const rawCode = String(children ?? '')
  const isInline = !match && !className && !isMarkdownCodeBlock(rawCode, node)
  if (isInline) {
    return (
      <code
        className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono"
        style={{ fontFamily: MONO_FONT }}
        {...props}
      >
        {children}
      </code>
    )
  }
  return (
    <CodeBlock language={match?.[1]} isStreaming={isStreaming}>
      {rawCode}
    </CodeBlock>
  )
}

// ── Markdown Components (from OpenCowork) ──
const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="mt-4 mb-2 first:mt-0 text-lg font-bold text-foreground border-b border-border/40 pb-1" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mt-3 mb-1.5 first:mt-0 text-base font-semibold text-foreground" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mt-2 mb-1 first:mt-0 text-sm font-semibold text-foreground" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="mt-2 mb-1 first:mt-0 text-sm font-medium text-foreground/90" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="mt-1.5 mb-0.5 first:mt-0 text-xs font-medium text-foreground/80 uppercase tracking-wide" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 className="mt-1.5 mb-0.5 first:mt-0 text-xs font-medium text-muted-foreground uppercase tracking-wide" {...props}>
      {children}
    </h6>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground italic" {...props}>
      {children}
    </blockquote>
  ),
  hr: ({ ...props }) => <hr className="my-3 border-border/50" {...props} />,
  a: ({ href, children }) => (
    <a
      href={href}
      onClick={(e) => {
        // Open external links in browser
        if (href && /^https?:\/\//i.test(href)) {
          e.preventDefault()
          window.open(href, '_blank')
        }
      }}
      className="text-primary underline underline-offset-2 hover:text-primary/80 cursor-pointer break-all"
      title={href}
    >
      {children}
    </a>
  ),
  p: ({ children, ...props }) => (
    <p className="my-1 first:mt-0 last:mb-0 leading-snug whitespace-pre-wrap break-words" {...props}>
      {children}
    </p>
  ),
  img: ({ src, alt, ...props }) => (
    <img
      {...props}
      src={src || ''}
      alt={alt || ''}
      className="my-3 block max-w-full rounded-lg border border-border/50 shadow-sm"
      loading="lazy"
    />
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-1 last:mb-0 list-disc pl-4 space-y-0.5" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-1 last:mb-0 list-decimal pl-4 space-y-0.5" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-snug break-words [&>p]:m-0 [&>p]:whitespace-pre-wrap" {...props}>
      {children}
    </li>
  ),
  table: ({ children, ...props }) => (
    <div className="my-3 overflow-x-auto max-w-full rounded-lg border border-border/60">
      <table className="min-w-0 w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted/60" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="divide-y divide-border/40" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }) => (
    <tr className="hover:bg-muted/30 transition-colors" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }) => (
    <th className="whitespace-pre-wrap break-words px-3 py-2 text-left font-semibold text-foreground/90 border-b border-border/60" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="whitespace-pre-wrap break-words px-3 py-2 text-foreground/80 border-r border-border/30 last:border-r-0" {...props}>
      {children}
    </td>
  ),
  pre: ({ children }) => <>{children}</>,
  code: MarkdownCode
}

// ── MarkdownContent (memoized) ──
const MarkdownContent = React.memo(function MarkdownContent({
  text,
  isStreaming = false
}: {
  text: string
  isStreaming?: boolean
}): React.JSX.Element {
  return (
    <IsStreamingContext.Provider value={isStreaming}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={MARKDOWN_COMPONENTS}
      >
        {text}
      </Markdown>
    </IsStreamingContext.Provider>
  )
})

// ── AssistantMessage ──
export function AssistantMessage({ message }: { message: ChatMessage }) {
  const { t } = useTranslation('chat')
  const [showThinking, setShowThinking] = useState(false)
  const hasThinking = !!(message.thinking && message.thinking.length > 0)
  const hasContent = !!(message.text && message.text.length > 0)

  return (
    <div className="group/msg flex flex-col">
      <div className="min-w-0 overflow-hidden pl-1.5 sm:pl-2">
        {/* Thinking section (collapsible) */}
        {hasThinking && (
          <div className="mb-2">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              {showThinking ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              <span>{t('message.thinking')}{message.isStreaming ? '...' : ''}</span>
            </button>
            {showThinking && (
              <div className="mt-1 ml-4 border-l-2 border-border/40 pl-3 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                {message.thinking}
              </div>
            )}
          </div>
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-1 mb-2">
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Main content */}
        {hasContent ? (
          <div className={MARKDOWN_WRAPPER_CLASS}>
            <MarkdownContent text={message.text} isStreaming={message.isStreaming} />
          </div>
        ) : message.isStreaming ? (
          <div className="flex items-center gap-1 py-1">
            <span className="text-sm text-muted-foreground">{t('message.generating')}</span>
            <span className="inline-flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        ) : null}

        {/* Streaming cursor */}
        {message.isStreaming && hasContent && (
          <span className={cn('inline-block h-3.5 w-0.5 animate-pulse bg-foreground/60 ml-0.5 align-text-bottom')} />
        )}

        {/* Error */}
        {message.error && (
          <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
            {message.error}
          </div>
        )}

        {/* Usage info */}
        {message.usage && !message.isStreaming && (
          <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
            {message.usage.inputTokens > 0 && <span>{t('message.inTokens')}: {message.usage.inputTokens}</span>}
            {message.usage.outputTokens > 0 && <span>{t('message.outTokens')}: {message.usage.outputTokens}</span>}
            {message.timing && <span>{(message.timing.totalMs / 1000).toFixed(1)}{t('message.seconds')}</span>}
            {message.timing?.tps && <span>{message.timing.tps.toFixed(1)} {t('message.tokensPerSecond')}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
