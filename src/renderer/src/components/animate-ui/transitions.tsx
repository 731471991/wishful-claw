import { AnimatePresence, motion, HTMLMotionProps } from 'motion/react'
import { ReactNode, ElementType, forwardRef } from 'react'
import { cn } from '@renderer/lib/utils'

type TransitionDirection = 'up' | 'down' | 'left' | 'right'

interface BaseTransitionProps extends HTMLMotionProps<'div'> {
  children: ReactNode
  className?: string
  as?: ElementType
  delay?: number
  duration?: number
}

interface SlideProps extends BaseTransitionProps {
  direction?: TransitionDirection
  offset?: number
}

export const spring = {
  stiff: { type: 'spring', stiffness: 400, damping: 30 },
  smooth: { type: 'spring', stiffness: 300, damping: 30, mass: 0.8 },
  slow: { type: 'spring', stiffness: 200, damping: 40 }
} as const

const ease = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.4, 0, 0.2, 1]
} as const

// Animations are always enabled for now. Later iterations can add a settings toggle.
const animationsEnabled = true

export const FadeIn = forwardRef<HTMLDivElement, BaseTransitionProps>(
  ({ children, className, delay = 0, duration = 0.2, as: Component = motion.div, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        initial={animationsEnabled ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        exit={animationsEnabled ? { opacity: 0 } : undefined}
        transition={animationsEnabled ? { duration, delay, ease: ease.out } : { duration: 0 }}
        className={className}
        {...props}
      >
        {children}
      </Component>
    )
  }
)
FadeIn.displayName = 'FadeIn'

export const SlideIn = forwardRef<HTMLDivElement, SlideProps>(
  ({ children, className, direction = 'up', offset = 10, delay = 0, as: Component = motion.div, ...props }, ref) => {
    const getInitial = (): { opacity: number; x?: number; y?: number } => {
      switch (direction) {
        case 'up':
          return { opacity: 0, y: offset }
        case 'down':
          return { opacity: 0, y: -offset }
        case 'left':
          return { opacity: 0, x: offset }
        case 'right':
          return { opacity: 0, x: -offset }
      }
    }
    return (
      <Component
        ref={ref}
        initial={animationsEnabled ? getInitial() : false}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={animationsEnabled ? getInitial() : undefined}
        transition={animationsEnabled ? { type: 'spring', stiffness: 400, damping: 30, delay } : { duration: 0 }}
        className={className}
        {...props}
      >
        {children}
      </Component>
    )
  }
)
SlideIn.displayName = 'SlideIn'

export const ScaleIn = forwardRef<HTMLDivElement, BaseTransitionProps>(
  ({ children, className, delay = 0, as: Component = motion.div, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        initial={animationsEnabled ? { opacity: 0, scale: 0.95 } : false}
        animate={{ opacity: 1, scale: 1 }}
        exit={animationsEnabled ? { opacity: 0, scale: 0.95 } : undefined}
        transition={animationsEnabled ? { ...spring.smooth, delay } : { duration: 0 }}
        className={className}
        {...props}
      >
        {children}
      </Component>
    )
  }
)
ScaleIn.displayName = 'ScaleIn'

export const PageTransition = forwardRef<HTMLDivElement, BaseTransitionProps>(
  ({ children, className, delay = 0, duration = 0.18, as: Component = motion.div, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        initial={animationsEnabled ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        exit={animationsEnabled ? { opacity: 0, transition: { duration: 0.12, ease: ease.out } } : undefined}
        transition={animationsEnabled ? { duration, delay, ease: ease.out } : { duration: 0 }}
        className={cn('size-full', className)}
        {...props}
      >
        {children}
      </Component>
    )
  }
)
PageTransition.displayName = 'PageTransition'

export const StaggerContainer = ({ children, className, delay = 0.05 }: { children: ReactNode; className?: string; delay?: number }) => {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      exit="hidden"
      variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: delay } } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export const StaggerItem = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring.smooth } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export const PanelTransition = forwardRef<HTMLDivElement, BaseTransitionProps & { side?: 'left' | 'right'; disabled?: boolean }>(
  ({ children, className, side = 'right', disabled = false, delay = 0, as: Component = motion.div, ...props }, ref) => {
    const shouldDisable = disabled || !animationsEnabled
    const xInitial = side === 'right' ? 20 : -20

    if (shouldDisable) {
      return (
        <Component ref={ref} className={cn('overflow-hidden', className)} {...props}>
          <div className="h-full w-max">{children}</div>
        </Component>
      )
    }

    return (
      <Component
        ref={ref}
        initial={{ width: 0, opacity: 0, x: xInitial }}
        animate={{ width: 'auto', opacity: 1, x: 0 }}
        exit={{ width: 0, opacity: 0, x: xInitial }}
        transition={{ type: 'spring', stiffness: 350, damping: 30, delay, opacity: { duration: 0.2 } }}
        className={cn('overflow-hidden', className)}
        {...props}
      >
        <div className="h-full w-max">{children}</div>
      </Component>
    )
  }
)
PanelTransition.displayName = 'PanelTransition'

export { AnimatePresence }
