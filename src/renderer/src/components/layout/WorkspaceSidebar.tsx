import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Settings, FolderTree, Sparkles, Ghost, RefreshCw, PenTool, GitBranch, Plus, Search, FolderOpen, ChevronRight, PanelLeftClose, Image, CalendarDays } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@renderer/components/ui/dropdown-menu'
import { useUIStore } from '@renderer/stores/ui-store'
import { useChatStore, type Session } from '@renderer/stores/chat-store'
import { cn } from '@renderer/lib/utils'
import { APP_VERSION_LABEL } from '@renderer/lib/app-version'
import { toast } from 'sonner'
import { WorkingFolderSelectorDialog } from '@renderer/components/chat/WorkingFolderSelectorDialog'

// ─── Helpers ───
import { SessionItem, ProjectItem, sortProjects, sortSessions } from './workspace-sidebar-items'
import { ResizeHandle, renderNavItem, NavButtonItem } from './workspace-sidebar-nav'

export function WorkspaceSidebar(): React.JSX.Element | null {
  const { t } = useTranslation('layout')
  const leftSidebarOpen = useUIStore((s) => s.leftSidebarOpen)
  const leftSidebarWidth = useUIStore((s) => s.leftSidebarWidth)
  const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar)
  const setActiveNavItem = useUIStore((s) => s.setActiveNavItem)
  const navigateToHome = useUIStore((s) => s.navigateToHome)
  const navigateToSession = useUIStore((s) => s.navigateToSession)
  const activeSessionId = useChatStore((s) => s.activeSessionId)

  const sessions = useChatStore((s) => s.sessions)
  const projects = useChatStore((s) => s.projects)
  const setActiveProjectHome = useChatStore((s) => s.setActiveProjectHome)
  const createProject = useChatStore((s) => s.createProject)

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [searchQuery] = useState('')
  const [extensionsOpen, setExtensionsOpen] = useState(false)

  // Active project ID — used for highlighting only.
  // Expand/collapse is purely user-controlled via clicking the project title.
  // No auto-expand on active project change.

  // On initial mount: if there's an active session, expand its parent project
  // so the user can see which conversation is focused after restart.
  // This runs once — subsequent expand/collapse is purely user-controlled.
  const initialExpandDone = useRef(false)
  useEffect(() => {
    if (initialExpandDone.current) return
    if (!activeSessionId || sessions.length === 0) return
    const session = sessions.find((s) => s.id === activeSessionId)
    if (session?.projectId) {
      setExpandedProjects((prev) =>
        prev.has(session.projectId!) ? prev : new Set(prev).add(session.projectId!)
      )
    }
    initialExpandDone.current = true
  }, [activeSessionId, sessions])

  // Group sessions by project
  const { projectSessions, unassignedSessions } = useMemo(() => {
    const byProject: Record<string, Session[]> = {}
    const unassigned: Session[] = []

    for (const session of sessions) {
      if (session.projectId) {
        if (!byProject[session.projectId]) {
          byProject[session.projectId] = []
        }
        byProject[session.projectId].push(session)
      } else {
        unassigned.push(session)
      }
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      for (const key of Object.keys(byProject)) {
        byProject[key] = byProject[key].filter((s) => s.title.toLowerCase().includes(q))
      }
      const filtered = unassigned.filter((s) => s.title.toLowerCase().includes(q))
      return { projectSessions: byProject, unassignedSessions: filtered }
    }

    return { projectSessions: byProject, unassignedSessions: unassigned }
  }, [sessions, searchQuery])

  const sortedProjects = useMemo(() => sortProjects(projects), [projects])
  const sortedUnassigned = useMemo(() => sortSessions(unassignedSessions), [unassignedSessions])

  const toggleProjectExpand = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }, [])

  const handleNewChat = useCallback(() => {
    // Don't create a session yet — just navigate to home.
    // The session is created when the user actually sends a message.
    setActiveProjectHome(null)
    useUIStore.getState().setMode('chat')
    setActiveNavItem('chat')
    navigateToHome()
  }, [setActiveProjectHome, setActiveNavItem, navigateToHome])

  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false)

  const handleNewProject = useCallback(() => {
    setCreateProjectDialogOpen(true)
  }, [])

  const handleCreateProjectWithDirectory = useCallback(
    async (folderPath: string, _connectionId: string | null, projectName?: string) => {
      const name = projectName?.trim() || folderPath.split(/[\\/]/).pop() || 'New Project'
      const projectId = await createProject({ name, workingFolder: folderPath })
      useChatStore.getState().setActiveProjectHome(projectId)
      useUIStore.getState().navigateToProject(projectId)
      toast.success(t('sidebar.projectCreated', { defaultValue: 'Project created' }))
      setCreateProjectDialogOpen(false)
    },
    [createProject, t]
  )

  const openCommandPalette = useCallback(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true
      })
    )
  }, [])

  // Collapsed state: completely hidden, use TitleBar button to expand
  if (!leftSidebarOpen) {
    return null
  }

  // ─── Nav items ───
  const navItems: NavButtonItem[] = [
    {
      key: 'new-chat',
      label: t('sidebar.newChat', { defaultValue: 'New Chat' }),
      icon: <Plus className="size-4 shrink-0" />,
      active: false,
      onClick: handleNewChat
    },
    {
      key: 'search',
      label: t('sidebar.searchLabel', { defaultValue: 'Search' }),
      icon: <Search className="size-4 shrink-0" />,
      active: false,
      onClick: openCommandPalette
    },
    {
      key: 'draw',
      label: t('sidebar.drawLabel', { defaultValue: 'Draw' }),
      icon: <Image className="size-4 shrink-0" />,
      active: false,
      onClick: () => {
        setActiveNavItem('draw')
        toast.info(`Draw — ${t('sidebar.comingSoon', { defaultValue: 'coming soon' })}`)
      }
    },
    {
      key: 'automation',
      label: t('sidebar.automationLabel', { defaultValue: 'Automation' }),
      icon: <CalendarDays className="size-4 shrink-0" />,
      active: false,
      onClick: () => {
        setActiveNavItem('tasks')
        toast.info(`Automation — ${t('sidebar.comingSoon', { defaultValue: 'coming soon' })}`)
      }
    }
  ]

  const extensionItems = [
    { id: 'resources', icon: <FolderTree className="size-4" />, label: t('sidebar.resources', { defaultValue: 'Resources' }) },
    { id: 'skills', icon: <Sparkles className="size-4" />, label: t('sidebar.skills', { defaultValue: 'Skills' }) },
    { id: 'souls', icon: <Ghost className="size-4" />, label: t('sidebar.souls', { defaultValue: 'Souls' }) },
    { id: 'sync', icon: <RefreshCw className="size-4" />, label: t('sidebar.sync', { defaultValue: 'Sync' }) },
    { id: 'translate', icon: <PenTool className="size-4" />, label: t('sidebar.translate', { defaultValue: 'Translate' }) },
    { id: 'codegraph', icon: <GitBranch className="size-4" />, label: t('sidebar.codegraph', { defaultValue: 'Code Graph' }) }
  ]

  const currentWidth = leftSidebarWidth || 260

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground"
      style={{ width: currentWidth }}
    >
      {/* Title bar area */}
      <div className="flex h-10 shrink-0 items-center gap-2 px-2">
        <button
          onClick={toggleLeftSidebar}
          className="flex size-7 items-center justify-center rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground"
          title={t('sidebar.collapse', { defaultValue: 'Collapse sidebar' })}
        >
          <PanelLeftClose className="size-4" />
        </button>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-sidebar-foreground/90">
          Wishful Claw
        </div>
      </div>

      {/* Nav items + extensions */}
      <div className="space-y-1 px-2 py-1.5">
        {navItems.slice(0, 3).map(renderNavItem)}

        {/* Extensions dropdown (collapsible) */}
        <DropdownMenu open={extensionsOpen} onOpenChange={setExtensionsOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex h-8 w-full items-center gap-2 px-2 text-[13px] font-medium transition-colors rounded-md',
                extensionsOpen
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <FolderOpen className="size-4 shrink-0" />
              <span className="truncate">{t('sidebar.extensionsLabel', { defaultValue: 'Extensions' })}</span>
              <ChevronRight className="ml-auto size-3.5 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={6} className="w-40">
            {extensionItems.map((ext) => (
              <DropdownMenuItem
                key={ext.id}
                onSelect={() => {
                  setActiveNavItem(ext.id as never)
                  toast.info(`${ext.label} — ${t('sidebar.comingSoon', { defaultValue: 'coming soon' })}`)
                }}
              >
                {ext.icon}
                <span>{ext.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {navItems.slice(3).map(renderNavItem)}
      </div>

      {/* Project section header */}
      <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-2">
        <span className="text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
          {t('sidebar.projects', { defaultValue: 'Projects' })}
        </span>

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleNewProject}
                className="flex size-5 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                title={t('sidebar.newProject', { defaultValue: 'New Project' })}
              >
                <Plus className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('sidebar.newProject', { defaultValue: 'New Project' })}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {/* Projects */}
        {sortedProjects.map((project) => (
          <ProjectItem
            key={project.id}
            project={project}
            sessions={projectSessions[project.id] ?? []}
            isExpanded={expandedProjects.has(project.id)}
            onToggleExpand={() => toggleProjectExpand(project.id)}
          />
        ))}

        {/* Unassigned sessions */}
        {sortedUnassigned.length > 0 && (
          <div className="mt-2">
            <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50">
              {t('sidebar.conversations', { defaultValue: 'Conversations' })}
            </div>
            {sortedUnassigned.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={activeSessionId === session.id}
                onClick={() => navigateToSession(session.id)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {sortedProjects.length === 0 && sortedUnassigned.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <MessageSquare className="size-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/60">
              {t('sidebar.noSessionsYet', { defaultValue: 'No sessions yet. Click "New Chat" to start.' })}
            </p>
          </div>
        )}
      </div>

      {/* Bottom: Settings + version */}
      <div className="border-t px-2 py-1.5">
        <button
          onClick={() => useUIStore.getState().openSettings('provider')}
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Settings className="size-3.5" />
          {t('navRail.settings', { defaultValue: 'Settings' })}
          <span className="ml-auto text-[9px] text-muted-foreground/40 select-none">{APP_VERSION_LABEL}</span>
        </button>
      </div>

      <ResizeHandle />

      <WorkingFolderSelectorDialog
        open={createProjectDialogOpen}
        onOpenChange={setCreateProjectDialogOpen}
        createMode
        projectName={t('sidebar.newProject', { defaultValue: 'New Project' })}
        onSelectLocalFolder={(folderPath, projectName) => handleCreateProjectWithDirectory(folderPath, null, projectName)}
        onSelectSshFolder={(folderPath, connectionId, projectName) =>
          handleCreateProjectWithDirectory(folderPath, connectionId, projectName)
        }
      />
    </aside>
  )
}
