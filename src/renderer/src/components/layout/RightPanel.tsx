import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useUIStore, type RightPanelTabInstance } from '@renderer/stores/ui-store'
import { useChatStore } from '@renderer/stores/chat-store'
import { useAppPluginStore } from '@renderer/stores/app-plugin-store'
import { useAgentStore } from '@renderer/stores/agent-store'
import { BROWSER_PLUGIN_ID } from '@renderer/lib/app-plugin/types'
import { cn } from '@renderer/lib/utils'
import { RightPanelHeader } from './RightPanelHeader'
import { ActivityPanel } from '@renderer/components/activity/ActivityPanel'
import { MemoryPanel } from '@renderer/components/memory/MemoryPanel'
import { SubAgentsPanel } from '@renderer/components/layout/SubAgentsPanel'
import { BrowserPanel } from '@renderer/components/layout/BrowserPanel'
import { PreviewPanel } from '@renderer/components/layout/PreviewPanel'
import { AgentFilesPanel } from '@renderer/components/layout/AgentFilesPanel'
import { SessionChangeReviewPanel } from '@renderer/components/layout/SessionChangeReviewPanel'
import { WorkbenchPanel } from '@renderer/components/layout/WorkbenchPanel'
import { RIGHT_PANEL_DEFAULT_WIDTH, clampRightPanelWidth } from './right-panel-defs'


export function RightPanel(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const rightPanelOpen = useUIStore((state) => state.rightPanelOpen)
  const rightPanelWidth = useUIStore((state) => state.rightPanelWidth)
  const rightPanelTabs = useUIStore((state) => state.rightPanelTabs)
  const activeTabId = useUIStore((state) => state.rightPanelActiveTabId)
  const setRightPanelOpen = useUIStore((state) => state.setRightPanelOpen)
  const setRightPanelWidth = useUIStore((state) => state.setRightPanelWidth)
  const setRightPanelActiveTab = useUIStore((state) => state.setRightPanelActiveTab)
  const closeRightPanelTab = useUIStore((state) => state.closeRightPanelTab)
  const ensureBrowserTab = useUIStore((state) => state.ensureBrowserTab)
  const activeScopedSessionId = useUIStore((state) => state.activeScopedSessionId)

  const activeProjectId = useChatStore((state) => {
    const targetSessionId = activeScopedSessionId ?? state.activeSessionId
    const targetSession = targetSessionId
      ? state.sessions.find((item) => item.id === targetSessionId)
      : null
    return targetSession?.projectId ?? state.activeProjectId
  })
  const activeSessionId = useChatStore((state) => state.activeSessionId)
  const panelSessionId = activeScopedSessionId ?? activeSessionId ?? null
  const ensureWorkbenchTab = useUIStore((state) => state.ensureWorkbenchTab)

  // Auto-create workbench tab when this session has tool calls
  const sessionToolCallCount = useAgentStore((s) => {
    if (!panelSessionId) return 0
    const cache = s.sessionToolCallsCache[panelSessionId]
    if (cache) return cache.pending.length + cache.executed.length
    return s.pendingToolCalls.filter(tc => tc.sessionId === panelSessionId).length +
           s.executedToolCalls.filter(tc => tc.sessionId === panelSessionId).length
  })

  useEffect(() => {
    if (sessionToolCallCount > 0) {
      ensureWorkbenchTab(panelSessionId)
    }
  }, [sessionToolCallCount, panelSessionId, ensureWorkbenchTab])

  // Listen for compact tool card click -> open workbench tab
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      ensureWorkbenchTab(detail?.sessionId ?? panelSessionId)
      setRightPanelOpen(true)
      const workbenchTab = useUIStore.getState().rightPanelTabs.find((t: any) => t.kind === 'workbench')
      if (workbenchTab) setRightPanelActiveTab(workbenchTab.id)
    }
    window.addEventListener('workbench:focus-tool', handler)
    return () => window.removeEventListener('workbench:focus-tool', handler)
  }, [panelSessionId, ensureWorkbenchTab, setRightPanelOpen, setRightPanelActiveTab])
  const workingFolder = useChatStore((state) => {
    const project = state.projects.find((p) => p.id === state.activeProjectId)
    return project?.workingFolder ?? null
  })
  const browserPluginEnabled = useAppPluginStore((state) =>
    Boolean(state.getPlugin(BROWSER_PLUGIN_ID, activeProjectId)?.enabled)
  )

  const tabs = useMemo(() => {
    const visibleTabs = rightPanelTabs
    if (!rightPanelOpen) return visibleTabs
    return visibleTabs.map((tab: any) => {
      if (tab.kind === 'activity') {
        return { ...tab, title: t('sectionExecution.title', { defaultValue: 'Activity' }) }
      }
      if (tab.kind === 'memory') {
        return { ...tab, title: t('memory.tabMemory', { defaultValue: 'Memory' }) }
      }
      if (tab.kind === 'browser') {
        return { ...tab, title: t('rightPanel.browser', { defaultValue: 'Browser' }) }
      }
      if (tab.kind === 'workbench') {
        return { ...tab, title: t('rightPanel.workbench', { defaultValue: 'Workbench' }) }
      }
      // subagent tabs keep their own title (set from task description)
      return tab
    })
  }, [rightPanelOpen, rightPanelTabs, t])

  const selectedTab =
    tabs.find((tab: any) => tab.id === activeTabId) ?? tabs[0]

  // The browser webview stays mounted whenever a browser tab exists and the plugin
  // is enabled — independent of whether the panel is open. This lets agent-driven
  // browser tools keep working in the background even while the panel is collapsed.
  const hasBrowserTab = tabs.some((tab: any) => tab.kind === 'browser')
  const browserTabAlive = hasBrowserTab && browserPluginEnabled
  const browserPanelKey = panelSessionId
    ? `session:${panelSessionId}`
    : activeProjectId
      ? `project:${activeProjectId}`
      : 'global'

  const activeTab = rightPanelOpen ? selectedTab : undefined
  const browserVisible = rightPanelOpen && activeTab?.kind === 'browser'

  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(rightPanelWidth)
  const [isDragging, setIsDragging] = useState(false)

  const targetPanelWidth = clampRightPanelWidth(rightPanelWidth)

  useEffect(() => {
    if (rightPanelWidth === 0) setRightPanelWidth(RIGHT_PANEL_DEFAULT_WIDTH)
  }, [rightPanelWidth, setRightPanelWidth])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (event: MouseEvent): void => {
      if (!draggingRef.current) return
      const delta = startXRef.current - event.clientX
      setRightPanelWidth(clampRightPanelWidth(startWidthRef.current + delta))
    }

    const handleMouseUp = (): void => {
      draggingRef.current = false
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, setRightPanelWidth])

  const startResize = (event: React.MouseEvent): void => {
    if (!rightPanelOpen) return
    event.preventDefault()
    draggingRef.current = true
    startXRef.current = event.clientX
    startWidthRef.current = targetPanelWidth
    setIsDragging(true)
  }

  const renderActivePanel = (tab: RightPanelTabInstance | undefined): React.ReactNode => {
    if (!tab) return null
    if (tab.kind === 'activity') {
      return <ActivityPanel />
    }
    if (tab.kind === 'memory') {
      return <MemoryPanel workingFolder={workingFolder} />
    }
    if (tab.kind === 'subagent') {
      return <SubAgentsPanel sessionId={tab.sessionId ?? panelSessionId} />
    }
    if (tab.kind === 'browser') return null  // BrowserPanel is rendered as persistent layer
    if (tab.kind === 'preview') return <PreviewPanel embedded />
    if (tab.kind === 'files') return <AgentFilesPanel sessionId={tab.sessionId ?? panelSessionId} />
    if (tab.kind === 'review') return <SessionChangeReviewPanel sessionId={tab.sessionId ?? panelSessionId} />
    if (tab.kind === 'workbench') return <WorkbenchPanel sessionId={tab.sessionId ?? panelSessionId} />
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {t('thinking.thinkingEllipsis', { ns: 'chat', defaultValue: 'Loading...' })}
      </div>
    )
  }

  return (
    <div
      data-tour="right-panel"
      className="relative z-40 h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-out"
      style={{ width: rightPanelOpen ? targetPanelWidth : 0 }}
    >
      <aside
        className={cn(
          'relative flex h-full w-full flex-col border-l border-border/60 bg-background shadow-[-18px_0_42px_rgba(0,0,0,0.16)] transition-[opacity,transform] duration-300 ease-out',
          rightPanelOpen
            ? 'translate-x-0 opacity-100'
            : 'pointer-events-none translate-x-full opacity-0'
        )}
      >
        {rightPanelOpen ? (
          <>
            <RightPanelHeader
              tabs={tabs}
              activeTabId={activeTab?.id ?? ''}
              browserEnabled={browserPluginEnabled}
              onSelectTab={setRightPanelActiveTab}
              onCloseTab={closeRightPanelTab}
              onAddBrowser={() => ensureBrowserTab(undefined, panelSessionId)}
              onOpenFile={() => {
                import('@renderer/lib/ipc/ipc-client').then(({ ipcClient }) => {
                  ipcClient.invoke('fs:select-file', { multiSelections: true }).then((result) => {
                    const r = result as { canceled?: boolean; paths?: string[]; path?: string }
                    if (r.canceled) return
                    const selectedPaths = r.paths?.length ? r.paths : r.path ? [r.path] : []
                    for (const p of selectedPaths) {
                      useUIStore.getState().openFilePreview(p)
                    }
                  })
                })
              }}
              onClosePanel={() => setRightPanelOpen(false)}
              t={t}
            />

            <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
              <AnimatePresence mode="wait">
                {activeTab?.kind !== 'browser' ? (
                  <motion.div
                    key={activeTab?.id ?? 'empty'}
                    className="absolute inset-0 min-h-0"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                  >
                    {renderActivePanel(activeTab)}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div
              className="absolute left-0 top-0 bottom-0 z-[60] w-1.5 cursor-col-resize transition-colors hover:bg-primary/30"
              onMouseDown={startResize}
            />
          </>
        ) : null}

        {/* Persistent browser layer: mounted whenever a browser tab exists so the
            webview keeps running even when the panel is closed or another tab is
            active. When hidden it stays in the DOM (webview connected) but
            non-interactive and transparent. */}
        {browserTabAlive ? (
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 top-10',
              browserVisible ? 'z-10 opacity-100' : 'pointer-events-none -z-10 opacity-0'
            )}
          >
            <BrowserPanel
              key={browserPanelKey}
              sessionId={panelSessionId}
              projectId={activeProjectId}
            />
          </div>
        ) : null}
      </aside>

      {isDragging && <div className="fixed inset-0 z-[100] cursor-col-resize" />}
    </div>
  )
}
