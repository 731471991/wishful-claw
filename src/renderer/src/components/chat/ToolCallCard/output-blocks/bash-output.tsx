import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Square } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { MONO_FONT } from '@renderer/lib/constants'
import { estimateTokens, formatTokens } from '@renderer/lib/format-tokens'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { Button } from '@renderer/components/ui/button'
import type { ToolCallStatus } from '@renderer/lib/agent/types'
import { decodeStructuredToolResult } from '@renderer/lib/tools/tool-result-format'
import type { LiveShellOutputState } from '../types'
import {
  normalizeLiveShellChunk,
  normalizeShellResult,
  buildStoredShellOutput,
  appendLiveShellOutput,
  getShellInputCommand,
  getShellCwd,
  buildShellPromptLine,
  getBashInputTerminalId
} from '../utils'
import { CopyBtn } from '../shared'

export function BashOutputBlock({
  name,
  output,
  input,
  toolUseId,
  status
}: {
  name: string
  output: string
  input: Record<string, unknown>
  toolUseId?: string
  status: ToolCallStatus | 'completed'
}): React.JSX.Element {
  const { t } = useTranslation('chat')
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const sendBackgroundProcessInput = useAgentStore((s) => s.sendBackgroundProcessInput)
  const stopBackgroundProcess = useAgentStore((s) => s.stopBackgroundProcess)
  const abortForegroundShellExec = useAgentStore((s) => s.abortForegroundShellExec)
  const foregroundExec = useAgentStore((s) =>
    toolUseId ? s.foregroundShellExecByToolUseId[toolUseId] : undefined
  )
  const foregroundExecId =
    foregroundExec?.execId ??
    ((status === 'running' || status === 'streaming') && toolUseId ? toolUseId : undefined)
  const [liveShellOutput, setLiveShellOutput] = React.useState<LiveShellOutputState>({
    execId: null,
    text: ''
  })
  const terminalRef = React.useRef<HTMLPreElement>(null)

  React.useEffect(() => {
    if (!foregroundExecId || (status !== 'running' && status !== 'streaming')) {
      setLiveShellOutput((current) =>
        current.execId === null ? current : { execId: null, text: '' }
      )
      return
    }

    setLiveShellOutput({ execId: foregroundExecId, text: '' })
    return ipcClient.on(IPC.SHELL_OUTPUT, (payload) => {
      const data = payload as { execId?: unknown; chunk?: unknown; stream?: unknown }
      const chunk = data.chunk
      if (data.execId !== foregroundExecId || typeof chunk !== 'string') return
      setLiveShellOutput((current) => appendLiveShellOutput(current, foregroundExecId, chunk))
    })
  }, [foregroundExecId, status])

  const parsed = React.useMemo(() => {
    const obj = decodeStructuredToolResult(output)
    return normalizeShellResult(obj)
  }, [output])

  const processId = parsed?.processId ? String(parsed.processId) : null
  const process = useAgentStore((s) => (processId ? s.backgroundProcesses[processId] : undefined))
  const inputTerminalId = React.useMemo(() => getBashInputTerminalId(input), [input])
  const isProcessRunning = process?.status === 'running'
  const exitCode = process?.exitCode ?? parsed?.exitCode
  const statusText = process ? t(`toolCall.processStatus.${process.status}`) : null
  const canStopForegroundExec =
    !process && status === 'running' && !!toolUseId && !!foregroundExecId

  const liveText = liveShellOutput.execId === foregroundExecId ? liveShellOutput.text : ''
  const storedText = parsed ? buildStoredShellOutput(parsed) : normalizeLiveShellChunk(output)
  const rawText = process
    ? process.output
    : liveText.length > storedText.length
      ? liveText
      : storedText
  const command = getShellInputCommand(input, foregroundExec?.command ?? parsed?.command)
  const cwd = getShellCwd(input, foregroundExec?.cwd ?? parsed?.cwd)
  const promptLine = buildShellPromptLine(name, cwd, command)
  const text = rawText ? `${promptLine}\n${rawText.replace(/^\n+/, '')}` : promptLine
  const lineCount = text.split('\n').length
  const tokenCount = React.useMemo(() => estimateTokens(text), [text])

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const el = terminalRef.current
      if (!el) return
      el.scrollTop = el.scrollHeight
    })
    return () => window.cancelAnimationFrame(frame)
  }, [text])

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#0b0d10] shadow-none">
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] bg-[#111418] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-zinc-200">{t('toolCall.shell')}</span>
            {processId ? (
              <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-zinc-500">
                {processId}
              </span>
            ) : null}
            {inputTerminalId ? (
              <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-zinc-500">
                {inputTerminalId}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <CopyBtn text={text} />
          </div>
        </div>

        <pre
          ref={terminalRef}
          className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words px-3 py-2.5 text-[11px] leading-5 text-zinc-100"
          style={{ fontFamily: MONO_FONT }}
        >
          {text}
        </pre>

        {(statusText || exitCode !== undefined || lineCount > 0) && (
          <div className="flex items-center justify-between gap-2 border-t border-white/[0.08] bg-[#111418] px-3 py-2">
            <span className="text-[10px] text-zinc-500">
              {t('toolCall.lineCount', { count: lineCount })} ·{' '}
              {t('toolCall.tokenCount', { value: formatTokens(tokenCount) })}
            </span>
            <div className="flex items-center gap-2 text-[11px]">
              {statusText && exitCode === undefined ? (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5',
                    process?.status === 'running'
                      ? 'bg-blue-500/12 text-blue-300'
                      : process?.status === 'error'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-white/[0.06] text-zinc-400'
                  )}
                >
                  {statusText}
                </span>
              ) : null}
              {exitCode !== undefined ? (
                exitCode === 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-emerald-300">
                    <Check className="size-3" />
                    {t('toolCall.success')}
                  </span>
                ) : (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
                    {t('toolCall.exitCode', { code: exitCode })}
                  </span>
                )
              ) : null}
            </div>
          </div>
        )}
      </div>

      {process ? (
        <div className="mt-2 flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => openDetailPanel({ type: 'terminal', processId: process.id })}
          >
            {t('toolCall.openSession')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={!isProcessRunning}
            onClick={() => void sendBackgroundProcessInput(process.id, '\u0003', false)}
          >
            {t('toolCall.sendCtrlC')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            disabled={!isProcessRunning}
            onClick={() => void stopBackgroundProcess(process.id)}
          >
            <Square className="size-2.5 fill-current" />
            {t('toolCall.stopProcess')}
          </Button>
        </div>
      ) : null}

      {canStopForegroundExec ? (
        <div className="mt-2 flex items-center gap-1.5">
          <Button
            variant="destructive"
            size="sm"
            className="h-6 gap-1 px-2 text-[10px]"
            onClick={() => {
              if (!toolUseId) return
              void abortForegroundShellExec(toolUseId)
            }}
          >
            <Square className="size-2.5 fill-current" />
            {t('toolCall.stopProcess')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
