import * as React from 'react'

export function Collapsible({ children, open, onOpenChange, className }: {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}) {
  return <div className={className}>{open !== false ? children : null}</div>
}

export function CollapsibleTrigger({ children, asChild, ...props }: {
  children: React.ReactNode
  asChild?: boolean
} & React.HTMLAttributes<HTMLButtonElement>) {
  return <button {...props}>{children}</button>
}

export function CollapsibleContent({ children, className }: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}
