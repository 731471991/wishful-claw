/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

import { useState, useEffect } from 'react'
import { Minus, Square, X, Copy } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export function WindowControls(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    // Get initial state
    void window.api.invoke<boolean>('window:isMaximized', {}).then(setIsMaximized)

    // Listen for maximize state changes from main process
    const unsub = window.api.on<boolean>('window:maximized', (maximized) => {
      setIsMaximized(maximized)
    })
    return unsub
  }, [])

  return (
    <div className="titlebar-no-drag flex items-center">
      {/* Minimize */}
      <button
        onClick={() => void window.api.invoke('window:minimize', {})}
        className="flex h-10 w-11 items-center justify-center text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
        aria-label="Minimize"
      >
        <Minus className="size-4" />
      </button>

      {/* Maximize / Restore */}
      <button
        onClick={() => void window.api.invoke('window:maximize', {})}
        className="flex h-10 w-11 items-center justify-center text-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? (
          <Copy className="size-3.5 -scale-x-100" />
        ) : (
          <Square className="size-3" />
        )}
      </button>

      {/* Close */}
      <button
        onClick={() => void window.api.invoke('window:close', {})}
        className={cn(
          'flex h-10 w-11 items-center justify-center text-foreground/60 transition-colors',
          'hover:bg-red-500 hover:text-white'
        )}
        aria-label="Close"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
