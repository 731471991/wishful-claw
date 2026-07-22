import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MessageSquare,
  Settings,
  FolderTree,
  Sparkles,
  Ghost,
  RefreshCw,
  PenTool,
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
  Archive,
  Image,
  CalendarDays
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useUIStore } from '@renderer/stores/ui-store'
import { useChatStore, type Session, type Project } from '@renderer/stores/chat-store'
import { cn } from '@renderer/lib/utils'
import { toast } from 'sonner'
import { WorkingFolderSelectorDialog } from '@renderer/components/chat/WorkingFolderSelectorDialog'
import { MoreHorizontal } from 'lucide-react'

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

// ─── Session Item ───

interface SessionItemProps {
  session: Session
  isActive: boolean
  onClick: () => void
}

function SessionItem({ session, isActive, onClick }: SessionItemProps): React.JSX.Element {
  const { t } = useTranslation('layout')
  const deleteSession = useChatStore((s) => s.deleteSession)
  const updateSessionTitle = useChatStore((s) => s.updateSessionTitle)
  const clearSessionMessages = useChatStore((s) => s.clearSessionMessages)
  const duplicateSession = useChatStore((s) => s.duplicateSession)
  const togglePinSession = useChatStore((s) => s.togglePinSession)
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

  const [changeFolderDialogOpen, setChangeFolderDialogOpen] = useState(false)

  const handleChangeFolder = useCallback(() => {
    setChangeFolderDialogOpen(true)
  }, [])

  const handleNewSessionInProject = useCallback(() => {
    // Navigate to home with project selected. Session is created when user sends a message.
    setActiveProjectHome(project.id)
    const uiStore = useUIStore.getState()
    if (uiStore.mode === 'chat') {
      uiStore.setMode('cowork')
    }
    uiStore.navigateToHome()
  }, [project.id, setActiveProjectHome])

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
            
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleNewSessionInProject()
                }}
                className="flex size-5 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                title={t('sidebar.newSessionInProject', { defaultValue: 'New session here' })}
              >
                <Plus className="size-3.5" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="flex size-5 items-center justify-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                    title={t('sidebar.moreActions', { defaultValue: 'More actions' })}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleNewSessionInProject}>
                    <Plus className="mr-2 size-3.5" />
                    {t('sidebar.newSessionInProject', { defaultValue: 'New session here' })}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRename}>
                    <Pencil className="mr-2 size-3.5" />
                    {t('sidebar.rename', { defaultValue: 'Rename' })}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => togglePinProject(project.id)}>
                    <Pin className="mr-2 size-3.5" />
                    {project.pinned
                      ? t('sidebar.unpin', { defaultValue: 'Unpin' })
                      : t('sidebar.pin', { defaultValue: 'Pin' })}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleChangeFolder}>
                    <FolderOpen className="mr-2 size-3.5" />
                    {t('sidebar.changeFolder', { defaultValue: 'Change working folder' })}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigateToArchive(project.id)}>
                    <Archive className="mr-2 size-3.5" />
                    {t('sidebar.archive', { defaultValue: 'Archive' })}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigateToGit(project.id)}>
                    <GitBranch className="mr-2 size-3.5" />
                    {t('sidebar.git', { defaultValue: 'Git' })}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="mr-2 size-3.5" />
                    {t('sidebar.deleteProject', { defaultValue: 'Delete project' })}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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

      <WorkingFolderSelectorDialog
        open={changeFolderDialogOpen}
        onOpenChange={setChangeFolderDialogOpen}
        workingFolder={project.workingFolder}
        sshConnectionId={project.sshConnectionId}
        onSelectLocalFolder={(folderPath) => {
          updateProjectDirectory(project.id, { workingFolder: folderPath, sshConnectionId: null })
          toast.success(t('sidebar.folderUpdated', { defaultValue: 'Working folder updated' }))
          setChangeFolderDialogOpen(false)
        }}
        onSelectSshFolder={(folderPath, connectionId) => {
          updateProjectDirectory(project.id, { workingFolder: folderPath, sshConnectionId: connectionId })
          toast.success(t('sidebar.folderUpdated', { defaultValue: 'Working folder updated' }))
          setChangeFolderDialogOpen(false)
        }}
      />

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

// ─── Nav item renderer ───

interface NavButtonItem {
  key: string
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

function renderNavItem(item: NavButtonItem): React.JSX.Element {
  return (
    <button
      key={item.key}
      type="button"
      onClick={item.onClick}
      className={cn(
        'flex h-8 w-full items-center gap-2 px-2 text-[13px] font-medium transition-colors rounded-md',
        item.active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
      )}
    >
      {item.icon}
      <span className="truncate">{item.label}</span>
    </button>
  )
}

// ─── Main WorkspaceSidebar (single column, OpenCowork-style) ───

export function WorkspaceSidebar(): React.JSX.Element {
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

  const handleNewChat = useCallback(() => {
    // Don't create a session yet — just navigate to home.
    // The session is created when the user actually sends a message.
    setActiveProjectHome(null)
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
      <div className="flex items-center justify-between border-t px-2 py-1.5">
        <button
          onClick={() => useUIStore.getState().openSettings('provider')}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Settings className="size-3.5" />
          {t('navRail.settings', { defaultValue: 'Settings' })}
        </button>
        <span className="text-[9px] text-muted-foreground/40 select-none">v0.4.0</span>
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
