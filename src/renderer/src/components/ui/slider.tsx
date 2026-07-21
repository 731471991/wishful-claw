import * as React from 'react'
import { cn } from '@renderer/lib/utils'

export const Slider = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="range"
    className={cn('w-full cursor-pointer appearance-none rounded-full bg-muted', className)}
    {...props}
  />
))
Slider.displayName = 'Slider'
