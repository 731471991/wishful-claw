import { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@renderer/lib/utils'

// ─── Popover Context ───

interface PopoverContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
}

const PopoverContext = createContext<PopoverContextValue | null>(null)

function usePopoverContext(): PopoverContextValue {
  const ctx = useContext(PopoverContext)
  if (!ctx) throw new Error('Popover components must be used within <Popover>')
  return ctx
}

// ─── Popover Root ───

export function Popover({
  open: openProp,
  onOpenChange,
  children
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}): React.JSX.Element {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = openProp ?? internalOpen
  const onOpenChangeHandler = onOpenChange ?? setInternalOpen
  const triggerRef = useRef<HTMLElement | null>(null)

  return (
    <PopoverContext.Provider value={{ open, onOpenChange: onOpenChangeHandler, triggerRef }}>
      {children}
    </PopoverContext.Provider>
  )
}

// ─── Popover Trigger ───

export function PopoverTrigger({
  asChild,
  children
}: {
  asChild?: boolean
  children: React.ReactElement
}): React.JSX.Element {
  const { open, onOpenChange, triggerRef } = usePopoverContext()

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      onOpenChange(!open)
    },
    [open, onOpenChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onOpenChange(!open)
      }
    },
    [open, onOpenChange]
  )

  const child = children as React.ReactElement<Record<string, unknown>>

  if (asChild) {
    return (
      <span
        ref={triggerRef as React.RefObject<HTMLSpanElement>}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        className="inline-flex"
      >
        {child}
      </span>
    )
  }

  return (
    <button
      ref={triggerRef as React.RefObject<HTMLButtonElement>}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {child}
    </button>
  )
}

// ─── Popover Content ───

interface PopoverContentProps {
  className?: string
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  collisionPadding?: number
}

export function PopoverContent({
  className,
  children,
  align = 'center',
  side = 'bottom',
  sideOffset = 4,
  collisionPadding = 8
}: PopoverContentProps): React.JSX.Element | null {
  const { open, onOpenChange, triggerRef } = usePopoverContext()
  const contentRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  // Calculate position based on trigger element
  useEffect(() => {
    if (!open || !triggerRef.current) {
      setCoords(null)
      return
    }

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    let top: number
    let left: number

    const estWidth = 256
    const estHeight = 400

    if (align === 'start') {
      left = triggerRect.left
    } else if (align === 'end') {
      left = triggerRect.right - estWidth
    } else {
      left = triggerRect.left + triggerRect.width / 2 - estWidth / 2
    }

    if (side === 'top') {
      top = triggerRect.top - sideOffset - estHeight
      if (top < collisionPadding) {
        top = triggerRect.bottom + sideOffset
      }
    } else if (side === 'right') {
      left = triggerRect.right + sideOffset
      top = triggerRect.top
    } else if (side === 'left') {
      left = triggerRect.left - sideOffset - estWidth
      top = triggerRect.top
    } else {
      top = triggerRect.bottom + sideOffset
      if (top + estHeight > viewportH - collisionPadding) {
        const flippedTop = triggerRect.top - sideOffset - estHeight
        if (flippedTop > collisionPadding) {
          top = flippedTop
        }
      }
    }

    left = Math.max(collisionPadding, Math.min(left, viewportW - estWidth - collisionPadding))
    top = Math.max(collisionPadding, Math.min(top, viewportH - 100 - collisionPadding))

    setCoords({ top, left })
  }, [open, triggerRef, align, side, sideOffset, collisionPadding])

  // Close on outside click
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (contentRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      // Check if clicking inside a nested popover content (portaled to body)
      const nested = (target as HTMLElement)?.closest('[data-popover-content]')
      if (nested) return
      onOpenChange(false)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [open, onOpenChange, triggerRef])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange])

  if (!open || !coords) return null

  return createPortal(
    <div
      ref={contentRef}
      data-popover-content="true"
      className={cn('fixed z-[9999]', className)}
      style={{ top: coords.top, left: coords.left }}
    >
      {children}
    </div>,
    document.body
  )
}
