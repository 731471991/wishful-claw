import * as React from 'react'
import { motion } from 'motion/react'

const PANEL_TRANSITION = { duration: 0.2, ease: 'easeInOut' as const }

interface CollapsibleHeightPanelProps {
  open: boolean
  children: React.ReactNode
  className?: string
  /** When false, content is always shown without animation (e.g. non-collapsible groups). */
  enabled?: boolean
  contentClassName?: string
}

/**
 * Height collapse/expand panel using motion.div.
 *
 * Uses a two-phase approach for closing:
 * 1. Measure current height and lock it as a px value (sync in layout effect)
 * 2. In the NEXT layout effect (after React commits the px value), animate to 0
 *
 * This avoids React 18 batching issues where setHeight(measured) + setHeight(0)
 * could be merged into a single update, skipping the intermediate px state
 * and causing the animation to fail (height jumps from 'auto' to 0 without animating).
 */
export function CollapsibleHeightPanel({
  open,
  children,
  className,
  enabled = true,
  contentClassName
}: CollapsibleHeightPanelProps): React.JSX.Element | null {
  const [mounted, setMounted] = React.useState(open || !enabled)
  const [height, setHeight] = React.useState<number | 'auto'>(open || !enabled ? 'auto' : 0)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const openRef = React.useRef(open)
  // Phase tracking: 'idle' | 'locking' | 'collapsing'
  const phaseRef = React.useRef<'idle' | 'locking' | 'collapsing'>('idle')

  React.useLayoutEffect(() => {
    if (!enabled) {
      setMounted(true)
      setHeight('auto')
      openRef.current = open
      return
    }

    const wasOpen = openRef.current
    openRef.current = open

    if (open && !wasOpen) {
      // Opening: mount, set to 0 first, then measure and animate to measured height
      phaseRef.current = 'idle'
      setMounted(true)
      setHeight(0)
      requestAnimationFrame(() => {
        const measured = panelRef.current?.scrollHeight ?? 0
        setHeight(measured > 0 ? measured : 'auto')
      })
      return
    }

    if (!open && wasOpen) {
      // Closing: measure current height and lock it as px (phase 1)
      const measured = panelRef.current?.getBoundingClientRect().height ?? 0
      if (measured > 0) {
        phaseRef.current = 'locking'
        setHeight(measured)
      } else {
        // Can't measure, just collapse immediately
        phaseRef.current = 'collapsing'
        setHeight(0)
      }
      return
    }
  }, [enabled, open])

  // Phase 2 for closing: after React commits the locked px height, animate to 0
  React.useLayoutEffect(() => {
    if (phaseRef.current === 'locking') {
      phaseRef.current = 'collapsing'
      // Use double rAF to ensure the px height is painted before animating to 0
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHeight(0)
        })
      })
    }
  }, [height])

  // Content may resize while open (tool output arrives); keep a px lock when still on auto.
  React.useLayoutEffect(() => {
    if (!enabled || !open || !mounted) return
    if (height !== 'auto') return
    if (phaseRef.current !== 'idle') return
    const measured = panelRef.current?.scrollHeight ?? 0
    if (measured > 0) setHeight(measured)
  }, [children, enabled, height, mounted, open])

  if (!enabled) {
    return <div className={className}>{children}</div>
  }

  if (!mounted) return null

  const visible = open || height === 'auto' || (typeof height === 'number' && height > 0)

  return (
    <motion.div
      ref={panelRef}
      initial={false}
      animate={{
        height,
        opacity: visible ? 1 : 0
      }}
      transition={PANEL_TRANSITION}
      className={className}
      onAnimationComplete={() => {
        if (!open && height === 0) {
          phaseRef.current = 'idle'
          setMounted(false)
          return
        }
        if (open && typeof height === 'number' && height > 0) {
          phaseRef.current = 'idle'
          setHeight('auto')
        }
      }}
    >
      <div className={contentClassName}>{children}</div>
    </motion.div>
  )
}
