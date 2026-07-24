import * as React from 'react'
import { cn } from '@renderer/lib/utils'

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: number[]
  onValueChange?: (value: number[]) => void
  min?: number
  max?: number
  step?: number
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min, max, step, ...props }, ref) => (
    <input
      ref={ref}
      type="range"
      className={cn('w-full cursor-pointer appearance-none rounded-full bg-muted', className)}
      value={value?.[0] ?? 0}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        onValueChange?.([Number(e.target.value)])
      }}
      {...props}
    />
  )
)
Slider.displayName = 'Slider'
