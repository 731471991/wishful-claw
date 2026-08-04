import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import '@xterm/xterm/css/xterm.css'
import { useTheme } from 'next-themes'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'
import { getTerminalTheme, resolveAppThemeMode } from '@renderer/lib/theme-presets'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@renderer/stores/settings-store'

interface SshExecOutputEvent {
  execId?: string
  stream?: 'stdout' | 'stderr'
  data?: string
}

/**
 * Read-only xterm terminal that displays real-time SSH command output
 * from Agent-executed remote commands.
 *
 * Unlike the previous version, this listens to ALL ssh:exec-output events
 * (not filtered by a single execId) so that multiple agent commands
 * stream into the same terminal session sequentially.
 */
export function AgentSshTerminal({ connectionName }: { connectionName?: string }): React.JSX.Element {
  const { t } = useTranslation('settings')
  const { resolvedTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const lastExecIdRef = useRef<string>('')
  const themePreset = useSettingsStore((state) => state.themePreset)
  const initialThemeRef = useRef(getTerminalTheme(themePreset, resolveAppThemeMode(resolvedTheme)))
  const terminalTheme = getTerminalTheme(themePreset, resolveAppThemeMode(resolvedTheme))

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      cursorBlink: false,
      cursorStyle: 'bar',
      fontSize: 14,
      fontFamily:
        "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, 'Courier New', monospace",
      allowProposedApi: true,
      scrollback: 10000,
      convertEol: true,
      disableStdin: true,
      theme: initialThemeRef.current
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const unicodeAddon = new Unicode11Addon()

    term.loadAddon(fitAddon as any)
    term.loadAddon(webLinksAddon)
    term.loadAddon(unicodeAddon)
    term.unicode.activeVersion = '11'
    term.open(containerRef.current)
    termRef.current = term
    fitAddonRef.current = fitAddon

    // Write a header line
    term.writeln(`\x1b[36m[${t('terminal.agentSshSession', { defaultValue: 'Agent SSH Session' })}]\x1b[0m`)
    if (connectionName) {
      term.writeln(`\x1b[90mConnection: ${connectionName}\x1b[0m`)
    }
    term.writeln('')

    const scheduleFit = (): void => {
      requestAnimationFrame(() => {
        try {
          (fitAddon as any).fit()
        } catch {
          // ignore
        }
      })
    }
    scheduleFit()

    // Listen for ALL SSH exec output events — not filtered by execId.
    // All agent commands for this project stream into the same terminal.
    // A separator line is written when the execId changes (new command).
    const outputCleanup = ipcClient.on(IPC.SSH_EXEC_OUTPUT, (payload) => {
      const event = payload as SshExecOutputEvent
      if (!event.data) return

      // Write a separator when a new command starts (execId changes)
      if (event.execId && event.execId !== lastExecIdRef.current) {
        if (lastExecIdRef.current !== '') {
          // Add spacing between commands
          term.writeln('')
        }
        lastExecIdRef.current = event.execId
      }

      if (event.stream === 'stderr') {
        // Write stderr in red
        term.write(event.data.replace(/[^\r\n]+/g, (line) => `\x1b[31m${line}\x1b[0m`))
      } else {
        term.write(event.data)
      }
    })

    const handleWindowResize = (): void => scheduleFit()
    window.addEventListener('resize', handleWindowResize)

    const resizeObserver = new ResizeObserver(() => scheduleFit())
    resizeObserver.observe(containerRef.current)

    const initialFitTimer = window.setTimeout(() => scheduleFit(), 100)
    const delayedFitTimer = window.setTimeout(() => scheduleFit(), 350)

    return () => {
      outputCleanup()
      window.removeEventListener('resize', handleWindowResize)
      resizeObserver.disconnect()
      window.clearTimeout(initialFitTimer)
      window.clearTimeout(delayedFitTimer)
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
  }, [connectionName])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    term.options.theme = terminalTheme
  }, [terminalTheme])

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      style={{ backgroundColor: terminalTheme.background as string }}
    >
      <div className="min-h-0 flex-1 overflow-hidden p-1">
        <div
          ref={containerRef}
          className="h-full overflow-hidden"
        />
      </div>
    </div>
  )
}
