import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MessageSquare,
  Settings,
  Plug,
  FolderTree,
  Sparkles,
  Ghost,
  RefreshCw,
  PenTool,
  Languages,
  CheckSquare,
  GitBranch,
  Plus,
  Search,
  Pin,
  Trash2,
  Pencil,
  FolderOpen,
  Eraser,
  Copy,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  FolderPlus,
  Archive
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
// DropdownMenu not currently used but kept for future session list sort/filter
import { useUIStore, type NavItem } from '@renderer/stores/ui-store'
import { useChatStore, type Session, type Project } from '@renderer/stores/chat-store'
import { cn } from '@renderer/lib/utils'
import { toast } from 'sonner'

// ─── Nav items config ───

interface NavItemConfig {
  id: NavItem
  icon: React.ComponentType<{ className?: string }>
  labelKey: string
  labelDefault: string
  implemented: boolean
  iterLabel?: string
}

const NAV_ITEMS: NavItemConfig[] = [
  { id: 'chat', icon: MessageSquare, labelKey: 'nav.chat', labelDefault: 'Chat', implemented: true },
  { id: 'channels', icon: Plug, labelKey: 'nav.channels', labelDefault: 'Channels', implemented: false, iterLabel: '迭代四' },
  { id: 'resources', icon: FolderTree, labelKey: 'nav.resources', labelDefault: 'Resources', implemented: false, iterLabel: '后续' },
  { id: 'skills', icon: Sparkles, labelKey: 'nav.skills', labelDefault: 'Skills', implemented: false, iterLabel: '后续' },
  { id: 'souls', icon: Ghost, labelKey: 'nav.souls', labelDefault: 'Souls', implemented: false, iterLabel: '迭代七' },
  { id: 'sync', icon: RefreshCw, labelKey: 'nav.sync', labelDefault: 'Sync', implemented: false, iterLabel: '后续' },
  { id: 'draw', icon: PenTool, labelKey: 'nav.draw', labelDefault: 'Draw', implemented: false, iterLabel: '后续' },
  { id: 'translate', icon: Languages, labelKey: 'nav.translate', labelDefault: 'Translate', implemented: false, iterLabel: '后续' },
  { id: 'tasks', icon: CheckSquare, labelKey: 'nav.tasks', labelDefault: 'Tasks', implemented: false, iterLabel: '后续' },
  { id: 'codegraph', icon: GitBranch, labelKey: 'nav.codegraph', labelDefault: 'Code Graph', implemented: false, iterLabel: '后续' }
]

// ─── Helpers ───

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minute = 60_000
  const hour = 3_600_000
  const day = 86_400_000

  if (diff < minute) return 'just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`
  const date = new Date(timestamp)
  return date.toLocaleDateString()
}

function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return b.updatedAt - a.updatedAt
  })
}

function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return b.updatedAt - a.updatedAt
  })
}

// ─── NavRail (icon strip) ───

function NavRail(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const activeNavItem = useUIStore((s) => s.activeNavItem)
  const setActiveNavItem = useUIStore((s) => s.setActiveNavItem)
  const openSettings = useUIStore((s) => s.openSettings)
  const createSession = useChatStore((s) => s.createSession)
  const navigateToHome = useUIStore((s) => s.navigateToHome)

  const handleNavClick = useCallback((item: NavItemConfig) => {
    if (item.id === 'chat') {
      setActiveNavItem('chat')
      navigateToHome()
    } else {
      // For unimplemented items, just set active nav (shows placeholder page)
      setActiveNavItem(item.id)
      toast.info(`${item.labelDefault} — ${item.iterLabel ?? 'coming soon'}`)
    }
  }, [setActiveNavItem, navigateToHome])

  const handleNewChat = useCallback(() => {
    createSession('chat', null, { preserveProjectless: true })
    navigateToHome()
  }, [createSession, navigateToHome])

  return (
    <div className="flex h-full w-12 shrink-0 flex-col items-center border-r bg-sidebar py-2">
      {/* New Chat button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleNewChat}
            className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all duration-200 hover:bg-primary/90"
          >
            <Plus className="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{t('sidebar.newChat', { defaultValue: 'New Chat' })}</TooltipContent>
      </Tooltip>

      <div className="h-px w-6 bg-border/50" />

      {/* Nav items */}
      <div className="mt-2 flex flex-1 flex-col items-center gap-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeNavItem === item.id
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNavClick(item)}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-sidebar-accent text-foreground'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
                    !item.implemented && 'opacity-50'
                  )}
                >
                  <Icon className="size-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-2">
                <span>{t(item.labelKey, { defaultValue: item.labelDefault })}</span>
                {!item.implemented && item.iterLabel && (
                  <span className="text-[10px] text-muted-foreground">({item.iterLabel})</span>
                )}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      {/* Bottom: Settings */}
      <div className="flex flex-col items-center gap-1 pt-2">
        <div className="h-px w-6 bg-border/50" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => openSettings('provider')}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-sidebar-accent hover:text-foreground"
            >
              <Settings className="size-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{t('navRail.settings', { defaultValue: 'Settings' })}</TooltipContent>
        </Tooltip>
        <span className="text-[9px] text-muted-foreground/40 select-none">v0.3.1</span>
      </div>
    </div>
  )
}

// ─── Session Item ───

interface SessionItemProps {
  session: Session
  isActive: boolean
  onClick: () => void
}

function SessionItem({ session, isActive, onClick }: SessionItemProps): React.JSX.Element {
  const { t } = useTranslation('layout')
  const deleteSession = useChatStore((s) => s.deleteSession)
  const clearSessionMessages = useChatStore((s) => s.clearSessionMessages)
  const togglePinSession = useChatStore((s) => s.togglePinSession)
  const duplicateSession = useChatStore((s) => s.duplicateSession)
  const updateSessionTitle = useChatStore((s) => s.updateSessionTitle)
  const navigateToSession = useUIStore((s) => s.navigateToSession)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(session.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleRename = useCallback(() => {
    setEditTitle(session.title)
    setIsEditing(true)
  }, [session.title])

  const handleRenameSubmit = useCallback(() => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== session.title) {
      updateSessionTitle(session.id, trimmed)
    }
    setIsEditing(false)
  }, [editTitle, session.id, session.title, updateSessionTitle])

  const handleDelete = useCallback(() => {
    deleteSession(session.id)
  }, [session.id, deleteSession])

  const handleClear = useCallback(() => {
    clearSessionMessages(session.id)
    toast.success(t('sidebar.conversationCleared', { defaultValue: 'Conversation cleared' }))
  }, [session.id, clearSessionMessages, t])

  const handleDuplicate = useCallback(() => {
    const newId = duplicateSession(session.id)
    if (newId) {
      navigateToSession(newId)
      toast.success(t('sidebar.sessionDuplicated', { defaultValue: 'Session duplicated' }))
    }
  }, [session.id, duplicateSession, navigateToSession, t])

  if (isEditing) {
    return (
      <div className="px-2 py-1">
        <input
          ref={inputRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit()
            if (e.key === 'Escape') setIsEditing(false)
          }}
          className="w-full rounded border border-ring bg-background px-2 py-1 text-xs focus:outline-none"
        />
      </div>
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
            isActive
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          )}
        >
          {session.pinned && <Pin className="size-3 shrink-0 text-primary/60" />}
          <span className="flex-1 truncate">{session.title}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground/40 opacity-0 group-hover:opacity-100">
            {formatRelativeTime(session.updatedAt)}
          </span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleRename}>
          <Pencil className="mr-2 size-3.5" />
          {t('sidebar.rename', { defaultValue: 'Rename' })}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDuplicate}>
          <Copy className="mr-2 size-3.5" />
          {t('sidebar.duplicate', { defaultValue: 'Duplicate' })}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => togglePinSession(session.id)}>
          <Pin className="mr-2 size-3.5" />
          {session.pinned
            ? t('sidebar.unpin', { defaultValue: 'Unpin' })
            : t('sidebar.pin', { defaultValue: 'Pin' })}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleClear}>
          <Eraser className="mr-2 size-3.5" />
          {t('sidebar.clearMessages', { defaultValue: 'Clear messages' })}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDelete} className="text-destructive">
          <Trash2 className="mr-2 size-3.5" />
          {t('sidebar.deleteSession', { defaultValue: 'Delete session' })}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

// ─── Project Item ───

interface ProjectItemProps {
  project: Project
  sessions: Session[]
  isExpanded: boolean
  onToggleExpand: () => void
}

function ProjectItem({ project, sessions, isExpanded, onToggleExpand }: ProjectItemProps): React.JSX.Element {
  const { t } = useTranslation('layout')
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const activeProjectId = useChatStore((s) => s.activeProjectId)
  const setActiveProjectHome = useChatStore((s) => s.setActiveProjectHome)
  const deleteProject = useChatStore((s) => s.deleteProject)
  const renameProject = useChatStore((s) => s.renameProject)
  const togglePinProject = useChatStore((s) => s.togglePinProject)
  const updateProjectDirectory = useChatStore((s) => s.updateProjectDirectory)
  const createSession = useChatStore((s) => s.createSession)
  const navigateToProject = useUIStore((s) => s.navigateToProject)
  const navigateToSession = useUIStore((s) => s.navigateToSession)
  const navigateToArchive = useUIStore((s) => s.navigateToArchive)
  const navigateToGit = useUIStore((s) => s.navigateToGit)

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(project.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const isActive = activeProjectId === project.id
  const sortedSessions = useMemo(() => sortSessions(sessions), [sessions])

  const handleClick = useCallback(() => {
    setActiveProjectHome(project.id)
    navigateToProject(project.id)
  }, [project.id, setActiveProjectHome, navigateToProject])

  const handleRename = useCallback(() => {
    setEditName(project.name)
    setIsEditing(true)
  }, [project.name])

  const handleRenameSubmit = useCallback(() => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== project.name) {
      renameProject(project.id, trimmed)
    }
    setIsEditing(false)
  }, [editName, project.id, project.name, renameProject])

  const handleDelete = useCallback(async () => {
    await deleteProject(project.id)
    toast.success(t('sidebar.projectDeleted', { defaultValue: 'Project deleted' }))
  }, [project.id, deleteProject, t])

  const handleChangeFolder = useCallback(async () => {
    try {
      const result = await window.api.invoke<{ folderPath?: string; canceled?: boolean }>('dialog:openFolder', {})
      if (result && result.folderPath && !result.canceled) {
        updateProjectDirectory(project.id, { workingFolder: result.folderPath })
        toast.success(t('sidebar.folderUpdated', { defaultValue: 'Working folder updated' }))
      }
    } catch {
      toast.error(t('sidebar.folderUpdateFailed', { defaultValue: 'Failed to select folder' }))
    }
  }, [project.id, updateProjectDirectory, t])

  const handleNewSessionInProject = useCallback(() => {
    createSession('chat', project.id)
    navigateToSession(null)
  }, [createSession, project.id, navigateToSession])

  if (isEditing) {
    return (
      <div className="px-2 py-1">
        <input
          ref={inputRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit()
            if (e.key === 'Escape') setIsEditing(false)
          }}
          className="w-full rounded border border-ring bg-background px-2 py-1 text-xs font-medium focus:outline-none"
        />
      </div>
    )
  }

  return (
    <div className="select-none">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={handleClick}
            className={cn(
              'group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors',
              isActive && activeSessionId === null
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand()
              }}
              className="flex size-4 items-center justify-center shrink-0"
            >
              {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            </button>
            {project.pinned && <Pin className="size-3 shrink-0 text-primary/60" />}
            <FolderOpen className="size-3.5 shrink-0" />
            <span className="flex-1 truncate text-xs font-medium">{project.name}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground/40">{sessions.length}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleNewSessionInProject}>
            <Plus className="mr-2 size-3.5" />
            {t('sidebar.newSessionInProject', { defaultValue: 'New session here' })}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleRename}>
            <Pencil className="mr-2 size-3.5" />
            {t('sidebar.rename', { defaultValue: 'Rename' })}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => togglePinProject(project.id)}>
            <Pin className="mr-2 size-3.5" />
            {project.pinned
              ? t('sidebar.unpin', { defaultValue: 'Unpin' })
              : t('sidebar.pin', { defaultValue: 'Pin' })}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleChangeFolder}>
            <FolderOpen className="mr-2 size-3.5" />
            {t('sidebar.changeFolder', { defaultValue: 'Change working folder' })}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => navigateToArchive(project.id)}>
            <Archive className="mr-2 size-3.5" />
            {t('sidebar.archive', { defaultValue: 'Archive' })}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => navigateToGit(project.id)}>
            <GitBranch className="mr-2 size-3.5" />
            {t('sidebar.git', { defaultValue: 'Git' })}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleDelete} className="text-destructive">
            <Trash2 className="mr-2 size-3.5" />
            {t('sidebar.deleteProject', { defaultValue: 'Delete project' })}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Sessions under this project */}
      {isExpanded && sortedSessions.length > 0 && (
        <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-border/40 pl-2">
          {sortedSessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={activeSessionId === session.id}
              onClick={() => navigateToSession(session.id)}
            />
          ))}
        </div>
      )}
      {isExpanded && sortedSessions.length === 0 && (
        <div className="ml-6 py-1 text-[10px] text-muted-foreground/40">
          {t('sidebar.noSessions', { defaultValue: 'No sessions' })}
        </div>
      )}
    </div>
  )
}

// ─── Sidebar Header ───

function SidebarHeader(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const navigateToHome = useUIStore((s) => s.navigateToHome)
  const createSession = useChatStore((s) => s.createSession)
  const createProject = useChatStore((s) => s.createProject)
  const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar)

  const handleNewChat = useCallback(() => {
    createSession('chat', null, { preserveProjectless: true })
    navigateToHome()
  }, [createSession, navigateToHome])

  const handleNewProject = useCallback(async () => {
    try {
      const result = await window.api.invoke<{ folderPath?: string; canceled?: boolean }>('dialog:openFolder', {})
      if (result && result.folderPath && !result.canceled) {
        const folderName = result.folderPath.split(/[\\/]/).pop() ?? 'New Project'
        const projectId = await createProject({ name: folderName, workingFolder: result.folderPath })
        useUIStore.getState().navigateToProject(projectId)
        toast.success(t('sidebar.projectCreated', { defaultValue: 'Project created' }))
      }
    } catch {
      // dialog:openFolder not yet registered — create project without folder
      const projectId = await createProject({})
      useUIStore.getState().navigateToProject(projectId)
      toast.info(t('sidebar.selectFolderLater', { defaultValue: 'Select working folder from right-click menu' }))
    }
  }, [createProject, t])

  return (
    <div className="flex items-center justify-between border-b px-2 py-2">
      <button
        onClick={handleNewChat}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
      >
        <Plus className="size-3.5" />
        {t('sidebar.newChat', { defaultValue: 'New Chat' })}
      </button>

      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleNewProject}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <FolderPlus className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('sidebar.newProject', { defaultValue: 'New Project' })}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleLeftSidebar}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <PanelLeftClose className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('sidebar.collapse', { defaultValue: 'Collapse sidebar' })}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

// ─── Resize Handle ───

function ResizeHandle(): React.JSX.Element {
  const setLeftSidebarWidth = useUIStore((s) => s.setLeftSidebarWidth)
  const leftSidebarWidth = useUIStore((s) => s.leftSidebarWidth)
  const isDragging = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    const startX = e.clientX
    const startWidth = leftSidebarWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return
      const delta = moveEvent.clientX - startX
      setLeftSidebarWidth(startWidth + delta)
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [leftSidebarWidth, setLeftSidebarWidth])

  return (
    <div
      onMouseDown={handleMouseDown}
      className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/20"
    />
  )
}

// ─── Main WorkspaceSidebar ───

export function WorkspaceSidebar(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const leftSidebarOpen = useUIStore((s) => s.leftSidebarOpen)
  const leftSidebarWidth = useUIStore((s) => s.leftSidebarWidth)
  const activeSessionId = useChatStore((s) => s.activeSessionId)
  const navigateToSession = useUIStore((s) => s.navigateToSession)

  const sessions = useChatStore((s) => s.sessions)
  const projects = useChatStore((s) => s.projects)

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Auto-expand the active project
  const activeProjectId = useChatStore((s) => s.activeProjectId)
  useEffect(() => {
    if (activeProjectId && !expandedProjects.has(activeProjectId)) {
      setExpandedProjects((prev) => new Set([...prev, activeProjectId]))
    }
  }, [activeProjectId, expandedProjects])

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

  if (!leftSidebarOpen) {
    return <NavRail />
  }

  return (
    <div className="flex h-full shrink-0" style={{ width: leftSidebarWidth + 48 }}>
      <NavRail />

      <div className="relative flex min-w-0 flex-1 flex-col bg-sidebar/50">
        <SidebarHeader />

        {/* Search */}
        <div className="px-2 py-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('sidebar.search', { defaultValue: 'Search sessions...' })}
              className="w-full rounded-md border border-border/50 bg-background/50 py-1 pl-7 pr-2 text-xs placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
            />
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
                {t('sidebar.unassigned', { defaultValue: 'Unassigned' })}
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
                {searchQuery
                  ? t('sidebar.noResults', { defaultValue: 'No results found' })
                  : t('sidebar.noSessionsYet', { defaultValue: 'No sessions yet. Click "New Chat" to start.' })}
              </p>
            </div>
          )}
        </div>

        <ResizeHandle />
      </div>
    </div>
  )
}
