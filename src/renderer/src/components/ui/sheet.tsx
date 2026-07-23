import * as React from 'react'
import { Dialog, DialogContent, DialogOverlay } from './dialog'
import { cn } from '@renderer/lib/utils'

export function Sheet({ children, open, onOpenChange }: {
  children: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}>{children}</Dialog>
}

export function SheetContent({ children, className, side = 'right' }: {
  children: React.ReactNode
  className?: string
  showCloseButton?: boolean
  side?: 'left' | 'right' | 'top' | 'bottom'
}) {
  return (
    <DialogContent className={cn('p-0', className)}>
      {children}
    </DialogContent>
  )
}
