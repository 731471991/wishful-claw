import { lazy, Suspense, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2, Plus, SquareTerminal, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { useTerminalStore } from '@renderer/stores/terminal-store'
import { useChatStore } from '@renderer/stores/chat-store'
import { cn } from '@renderer/lib/utils'
import { useTranslation } from 'react-i18next'

const LocalTerminal = lazy(() =>
  import('./LocalTerminal').then((m) => ({ default: m.LocalTerminal }))
)

const AgentSshTerminal = lazy(() =>
  import('./AgentSshTerminal').then((m) => ({ default: m.AgentSshTerminal }))
)

function StatusDot({ status }: { status: 'running' | 'exited' | 'error' }): React.JSX.Element {
  return (
    <div
      className={cn(
        'size-1.5 shrink-0 rounded-full',
        status === 'running'
          ? 'bg-emerald-500'
          : status === 'error'
            ? 'bg-red-500'
            : 'bg-muted-foreground/50'
      )}
    />
  )
}

export function TerminalPanel(): React.JSX.Element {
  const { t } = useTranslation('settings')
  const animationsEnabled = useSettingsStore((s) => s.animationsEnabled)
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const initTerminal = useTerminalStore((s) => s.init)
  const createTab = useTerminalStore((s) => s.createTab)
  const closeTab = useTerminalStore((s) => s.closeTab)
  const setActiveTab = useTerminalStore((s) => s.setActiveTab)

  const activeSession = useChatStore((s) =>
    s.sessions.find((session) => session.id === s.activeSessionId)
  )
  const projectWorkingFolder = useChatStore((s) => {
    if (!activeSession?.projectId) return undefined
    return s.projects.find((p) => p.id === activeSession.projectId)?.workingFolder
  })

  const cwd = activeSession?.workingFolder || projectWorkingFolder

  useEffect(() => {
    initTerminal()
  }, [initTerminal])

  // Auto-create first terminal tab when panel opens with no tabs
  useEffect(() => {
    if (tabs.length === 0) {
      void createTab(cwd)
    }
  }, [tabs.length, createTab, cwd])

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0] ?? null

  const handleCreate = useCallback((): void => {
    void createTab(cwd)
  }, [createTab, cwd])

  const handleClose = useCallback(
    async (id: string): Promise<void> => {
      await closeTab(id)
    },
    [closeTab]
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center gap-1 border-b bg-background/70 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden pb-0.5">
          <AnimatePresence initial={false}>
            {tabs.length === 0 ? (
              <motion.span
                key="terminal-tabs-empty"
                initial={animationsEnabled ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                exit={animationsEnabled ? { opacity: 0 } : undefined}
                transition={{ duration: animationsEnabled ? 0.15 : 0 }}
                className="px-2 text-[11px] text-muted-foreground"
              >
                {t('terminal.noSessions', { defaultValue: 'No terminal sessions' })}
              </motion.span>
            ) : (
              tabs.map((tab) => {
                const isActive = tab.id === activeTab?.id
                return (
                  <motion.button
                    key={tab.id}
                    layout={animationsEnabled ? 'position' : false}
                    initial={animationsEnabled ? { opacity: 0, scale: 0.95 } : false}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={animationsEnabled ? { opacity: 0, scale: 0.95 } : undefined}
                    transition={
                      animationsEnabled
                        ? { type: 'spring', stiffness: 400, damping: 30 }
                        : { duration: 0 }
                    }
                    type="button"
                    className={cn(
                      'group relative flex h-8 shrink-0 items-center rounded-md border border-transparent px-2.5 text-left transition-colors',
                      isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                    onClick={() => setActiveTab(tab.id)}
                    title={`${tab.title} · ${tab.cwd}`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId={animationsEnabled ? 'terminal-tab-active' : undefined}
                        transition={
                          animationsEnabled
                            ? { type: 'spring', stiffness: 400, damping: 32 }
                            : { duration: 0 }
                        }
                        className="absolute inset-0 rounded-md border border-primary/30 bg-primary/10"
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <StatusDot status={tab.status} />
                      <span className="max-w-[120px] truncate text-xs font-medium">
                        {tab.title}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        className="ml-0.5 shrink-0 rounded p-0.5 text-muted-foreground/70 transition-colors hover:bg-muted/70 hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleClose(tab.id)
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          event.stopPropagation()
                          void handleClose(tab.id)
                        }}
                        title={t('terminal.closeTerminal', { defaultValue: 'Close terminal' })}
                      >
                        <X className="size-3" />
                      </span>
                    </span>
                  </motion.button>
                )
              })
            )}
          </AnimatePresence>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          onClick={handleCreate}
          title={t('terminal.newTerminal', { defaultValue: 'New terminal' })}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/* Terminal content */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {activeTab ? (
          tabs.map((tab) => (
            <div
              key={tab.id}
              className="absolute inset-0"
              style={{ display: tab.id === activeTab.id ? undefined : 'none' }}
            >
              {tab.kind === 'ssh-agent' ? (
                <Suspense fallback={null}>
                  <AgentSshTerminal execId={tab.execId ?? tab.id} />
                </Suspense>
              ) : tab.status === 'running' ? (
                <Suspense fallback={null}>
                  <LocalTerminal terminalId={tab.id} />
                </Suspense>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                  {tab.status === 'error' ? (
                    <>
                      <div>{t('terminal.exited', { defaultValue: 'Terminal exited' })}</div>
                      <div>{t('terminal.exitCode', { defaultValue: 'Exit code', code: tab.exitCode ?? '-' })}: {tab.exitCode ?? '-'}</div>
                    </>
                  ) : (
                    <>
                      <Loader2 className="size-4" />
                      <div>{t('terminal.ended', { defaultValue: 'Terminal ended' })}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-xs text-muted-foreground">
            <SquareTerminal className="size-10 text-muted-foreground/40" />
            <div>{t('terminal.selectToStart', { defaultValue: 'Select a terminal to get started' })}</div>
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={handleCreate}>
              <Plus className="size-3.5" />
              {t('terminal.newTerminal', { defaultValue: 'New terminal' })}
            </Button>
          </div>
        )}
      </div>

      {/* Status bar */}
      {activeTab && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
          <span className="min-w-0 truncate">{activeTab.title}</span>
          <span className="shrink-0 truncate">{activeTab.shell || activeTab.cwd || '-'}</span>
        </div>
      )}
    </div>
  )
}
