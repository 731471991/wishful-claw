import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Sparkles,
  Ghost,
  RefreshCw,
  PenTool,
  Languages,
  CheckSquare,
  GitBranch,
  Plug,
  FolderTree,
  Archive
} from 'lucide-react'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { useUIStore } from '@renderer/stores/ui-store'
import { useChatStore } from '@renderer/stores/chat-store'
import { dbLoadAll } from '@renderer/stores/chat-store/db-helpers'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { TitleBar } from './TitleBar'
import { RightPanel } from './RightPanel'
import { RuntimeStatusPanel } from './RuntimeStatusPanel'
import { CommandPalette } from './CommandPalette'
import { SessionConversationPane } from './SessionConversationPane'
import { PlaceholderPage } from './PlaceholderPage'
import { ChatHomePage } from '@renderer/components/chat/ChatHomePage'
import { ProjectHomePage } from '@renderer/components/chat/ProjectHomePage'
import { SettingsPage } from '@renderer/components/settings/SettingsPage'

// ─── Feature page registry ───

const FEATURE_PAGES: Record<string, { title: string; iterLabel: string; icon: React.ComponentType<{ className?: string }> }> = {
  skills: { title: 'Skills', iterLabel: '后续', icon: Sparkles },
  souls: { title: 'Souls', iterLabel: '迭代七', icon: Ghost },
  sync: { title: 'Sync', iterLabel: '后续', icon: RefreshCw },
  resources: { title: 'Resources', iterLabel: '后续', icon: FolderTree },
  translate: { title: 'Translate', iterLabel: '后续', icon: Languages },
  draw: { title: 'Draw', iterLabel: '后续', icon: PenTool },
  tasks: { title: 'Tasks', iterLabel: '后续', icon: CheckSquare },
  codegraph: { title: 'Code Graph', iterLabel: '后续', icon: GitBranch },
  channels: { title: 'Channels', iterLabel: '迭代四', icon: Plug }
}

// ─── Content area ───

function ContentArea(): React.JSX.Element {
  const activeNavItem = useUIStore((s) => s.activeNavItem)
  const chatView = useUIStore((s) => s.chatView)
  const settingsPageOpen = useUIStore((s) => s.settingsPageOpen)
  const skillsPageOpen = useUIStore((s) => s.skillsPageOpen)
  const soulsPageOpen = useUIStore((s) => s.soulsPageOpen)
  const syncPageOpen = useUIStore((s) => s.syncPageOpen)
  const resourcesPageOpen = useUIStore((s) => s.resourcesPageOpen)
  const translatePageOpen = useUIStore((s) => s.translatePageOpen)
  const drawPageOpen = useUIStore((s) => s.drawPageOpen)
  const tasksPageOpen = useUIStore((s) => s.tasksPageOpen)
  const codeGraphPageOpen = useUIStore((s) => s.codeGraphPageOpen)
  const activeSessionId = useChatStore((s) => s.activeSessionId)

  // Settings page (inline overlay)
  if (settingsPageOpen) {
    return <SettingsPage />
  }

  // Non-chat nav items → placeholder pages
  if (activeNavItem !== 'chat') {
    const config = FEATURE_PAGES[activeNavItem]
    if (config) {
      return <PlaceholderPage title={config.title} iterLabel={config.iterLabel} icon={config.icon} />
    }
  }

  // Feature page toggles (opened from within chat context)
  if (skillsPageOpen) return <PlaceholderPage title="Skills" iterLabel="后续" icon={Sparkles} />
  if (soulsPageOpen) return <PlaceholderPage title="Souls" iterLabel="迭代七" icon={Ghost} />
  if (syncPageOpen) return <PlaceholderPage title="Sync" iterLabel="后续" icon={RefreshCw} />
  if (resourcesPageOpen) return <PlaceholderPage title="Resources" iterLabel="后续" icon={FolderTree} />
  if (translatePageOpen) return <PlaceholderPage title="Translate" iterLabel="后续" icon={Languages} />
  if (drawPageOpen) return <PlaceholderPage title="Draw" iterLabel="后续" icon={PenTool} />
  if (tasksPageOpen) return <PlaceholderPage title="Tasks" iterLabel="后续" icon={CheckSquare} />
  if (codeGraphPageOpen) return <PlaceholderPage title="Code Graph" iterLabel="后续" icon={GitBranch} />

  // Chat views
  switch (chatView) {
    case 'home':
      return <ChatHomePage />
    case 'project':
      return <ProjectHomePage />
    case 'session':
      return <SessionConversationPane sessionId={activeSessionId} />
    case 'archive':
      return <PlaceholderPage title="Archive" iterLabel="后续" icon={Archive} />
    case 'git':
      return <PlaceholderPage title="Git" iterLabel="后续" icon={GitBranch} />
    case 'channels':
      return <PlaceholderPage title="Channels" iterLabel="迭代四" icon={Plug} />
    default:
      return <ChatHomePage />
  }
}

// ─── Title resolver ───

function useTitle(): { title: string; subtitle: string | null } {
  const { t } = useTranslation('layout')
  const chatView = useUIStore((s) => s.chatView)
  const activeNavItem = useUIStore((s) => s.activeNavItem)
  const settingsPageOpen = useUIStore((s) => s.settingsPageOpen)
  const activeSession = useChatStore((s) =>
    s.sessions.find((sess) => sess.id === s.activeSessionId)
  )
  const activeProject = useChatStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId)
  )

  return useMemo(() => {
    if (settingsPageOpen) {
      return { title: t('title.settings', { defaultValue: 'Settings' }), subtitle: null }
    }

    if (activeNavItem !== 'chat') {
      const config = FEATURE_PAGES[activeNavItem]
      if (config) {
        return { title: config.title, subtitle: config.iterLabel }
      }
    }

    switch (chatView) {
      case 'home':
        return { title: t('title.chat', { defaultValue: 'Chat' }), subtitle: null }
      case 'project':
        return { title: activeProject?.name ?? t('title.project', { defaultValue: 'Project' }), subtitle: activeProject?.workingFolder ?? null }
      case 'session':
        return { title: activeSession?.title ?? t('title.session', { defaultValue: 'Session' }), subtitle: activeProject?.name ?? null }
      case 'archive':
        return { title: t('title.archive', { defaultValue: 'Archive' }), subtitle: null }
      case 'git':
        return { title: t('title.git', { defaultValue: 'Git' }), subtitle: null }
      case 'channels':
        return { title: t('title.channels', { defaultValue: 'Channels' }), subtitle: null }
      default:
        return { title: 'Wishful Claw', subtitle: null }
    }
  }, [chatView, activeNavItem, settingsPageOpen, activeSession, activeProject, t])
}

// ─── MainLayout ───

export function MainLayout(): React.JSX.Element {

  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen)
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth)
  const runtimeStatusPanelOpen = useUIStore((s) => s.runtimeStatusPanelOpen)
  const ensureDefaultProject = useChatStore((s) => s.ensureDefaultProject)

  // Load projects + sessions from DB on startup, then ensure default project
  useEffect(() => {
    void (async () => {
      if (useChatStore.getState().sessions.length > 0) return
      const data = await dbLoadAll()
      if (data && data.projects.length > 0) {
        // Build project map for session hydration
        const projectMap = new Map(data.projects.map((p) => [p.id, p]))

        // Hydrate sessions: inherit workingFolder from project if session doesn't have one
        const sessions = data.sessions.map((session) => {
          if (session.projectId) {
            const project = projectMap.get(session.projectId)
            if (project) {
              if (!session.workingFolder && project.workingFolder) {
                session.workingFolder = project.workingFolder
              }
              if (!session.sshConnectionId && project.sshConnectionId) {
                session.sshConnectionId = project.sshConnectionId
              }
            }
          }
          // messageCount === 0 → no messages to load, mark as loaded
          if (session.messageCount === 0) {
            session.messagesLoaded = true
            session.loadedRangeStart = 0
            session.loadedRangeEnd = 0
            session.lastKnownMessageCount = 0
          }
          return session
        })

        // Use set() so immer runs syncSessionsById and creates proper drafts
        let nextActiveSessionId: string | null = null
        let nextActiveProjectId: string | null = null

        useChatStore.setState((state) => {
          state.projects = data.projects
          state.sessions = sessions
          // Rebuild sessionsById index
          state.sessionsById = {}
          for (let i = 0; i < sessions.length; i++) {
            state.sessionsById[sessions[i].id] = i
          }

          nextActiveSessionId = sessions[0]?.id ?? null
          state.activeSessionId = nextActiveSessionId

          nextActiveProjectId = sessions[0]?.projectId ?? data.projects[0]?.id ?? null
          state.activeProjectId = nextActiveProjectId
        })

        // Load messages for the active session (like OpenCowork does)
        if (nextActiveSessionId) {
          await useChatStore.getState().loadRecentSessionMessages(nextActiveSessionId)
          // Navigate to session view so user sees the conversation directly
          useUIStore.getState().navigateToSession(nextActiveSessionId)
        }
      } else {
        // No projects in DB, ensure default
        void ensureDefaultProject()
      }
    })()
  }, [ensureDefaultProject])

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Left: NavRail + Sidebar */}
        <WorkspaceSidebar />

        {/* Center: Title bar + Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <TitleBar />

          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Main content */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <ContentArea />
            </div>

            {/* Right panel */}
            {rightPanelOpen && (
              <div className="shrink-0" style={{ width: rightPanelWidth }}>
                <RightPanel />
              </div>
            )}
          </div>
        </div>

        {/* Runtime status panel (bottom or floating) */}
        {runtimeStatusPanelOpen && <RuntimeStatusPanel />}

        {/* Command palette overlay */}
        <CommandPalette />
      </div>
    </TooltipProvider>
  )
}
