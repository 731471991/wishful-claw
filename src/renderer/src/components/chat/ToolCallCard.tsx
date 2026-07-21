import { useState } from 'react'
import type { ToolCallInfo } from '@renderer/stores/chat-store'
import { useTranslation } from 'react-i18next'

interface ToolCallCardProps {
  toolCall: ToolCallInfo
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const statusColor =
    toolCall.status === 'running'
      ? 'text-blue-500'
      : toolCall.status === 'error'
        ? 'text-red-500'
        : 'text-green-500'

  const statusIcon =
    toolCall.status === 'running'
      ? '⟳'
      : toolCall.status === 'error'
        ? '✕'
        : '✓'

  return (
    <div className="my-2 rounded-lg border border-[var(--border-color,#e5e7eb)] bg-[var(--bg-secondary,#f9fafb)] overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-hover,#f3f4f6)] transition-colors"
      >
        <span className="text-sm">{statusIcon}</span>
        <span className="font-mono text-xs font-medium text-[var(--text-primary,#111827)]">
          {toolCall.name}
        </span>
        <span className={`text-xs ${statusColor}`}>
          {toolCall.status === 'running' ? t('chat.tool.running', 'running') : toolCall.status}
        </span>
        <span className="ml-auto text-xs text-[var(--text-tertiary,#9ca3af)]">
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[var(--border-color,#e5e7eb)] px-3 py-2">
          {/* Input */}
          {Object.keys(toolCall.input).length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-medium text-[var(--text-secondary,#6b7280)] mb-1">
                {t('chat.tool.input', 'Input')}
              </div>
              <pre className="text-xs font-mono bg-[var(--bg-code,#f3f4f6)] rounded p-2 overflow-x-auto max-h-48">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}

          {/* Output */}
          {toolCall.output && (
            <div>
              <div className="text-xs font-medium text-[var(--text-secondary,#6b7280)] mb-1">
                {t('chat.tool.output', 'Output')}
              </div>
              <pre className={`text-xs font-mono rounded p-2 overflow-x-auto max-h-64 ${
                toolCall.status === 'error'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-[var(--bg-code,#f3f4f6)]'
              }`}>
                {toolCall.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
