import { useState, useCallback, createContext, useContext } from 'react'
import { cn } from '@renderer/lib/utils'

// ─── Popover Context ───

interface PopoverContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
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

  return (
    <PopoverContext.Provider value={{ open, onOpenChange: onOpenChangeHandler }}>
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
  const { open, onOpenChange } = usePopoverContext()

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
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

  if (asChild) {
    return (
      <span
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        className="inline-flex"
      >
        {children}
      </span>
    )
  }

  return (
    <button onClick={handleClick} onKeyDown={handleKeyDown}>
      {children}
    </button>
  )
}

// ─── Popover Content ───

export function PopoverContent({
  className,
  children,
  align = 'center',
  side = 'bottom',
  sideOffset = 0
}: {
  className?: string
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
}): React.JSX.Element | null {
  const { open } = usePopoverContext()

  if (!open) return null

  const sideClass = side === 'top' ? 'bottom-full' : side === 'right' ? 'left-full top-0' : 'top-full'
  const alignClass = align === 'start' ? 'left-0' : align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'

  return (
    <div
      className={cn(
        'absolute z-50',
        sideClass,
        alignClass,
        side === 'top' && `mb-${sideOffset}`,
        side !== 'top' && side !== 'bottom' && `ml-${sideOffset}`,
        side === 'bottom' && `mt-${sideOffset}`,
        className
      )}
    >
      {children}
    </div>
  )
}
