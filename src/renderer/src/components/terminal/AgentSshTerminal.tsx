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
import { useSettingsStore } from '@renderer/stores/settings-store'

interface SshExecOutputEvent {
  execId?: string
  stream?: 'stdout' | 'stderr'
  data?: string
}

/**
 * Read-only xterm terminal that displays real-time SSH command output
 * from Agent-executed remote commands. Listens to ssh:exec-output IPC events
 * matching the given execId and writes them to the terminal.
 *
 * This component does NOT support input — it is purely for observation.
 */
export function AgentSshTerminal({ execId }: { execId: string }): React.JSX.Element {
  const { resolvedTheme } = useTheme()
  const themePreset = useSettingsStore((state) => state.themePreset)
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
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

    // Write a header line indicating this is an agent SSH session
    term.writeln(`\x1b[36m[Agent SSH Session]\x1b[0m execId: ${execId.slice(0, 8)}...`)
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

    // Listen for SSH exec output events matching this execId
    const outputCleanup = ipcClient.on(IPC.SSH_EXEC_OUTPUT, (payload) => {
      const event = payload as SshExecOutputEvent
      if (event.execId !== execId || !event.data) return

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
  }, [execId])

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
