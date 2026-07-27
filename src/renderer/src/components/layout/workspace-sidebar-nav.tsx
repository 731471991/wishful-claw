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


export function ResizeHandle(): React.JSX.Element {
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

export function renderNavItem(item: NavButtonItem): React.JSX.Element {
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

