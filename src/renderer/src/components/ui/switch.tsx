'use client'

import * as React from 'react'

import { cn } from '@renderer/lib/utils'

type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  size?: 'sm' | 'default'
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  {
    className,
    size = 'default',
    checked,
    defaultChecked = false,
    disabled,
    onCheckedChange,
    onClick,
    children,
    ...props
  },
  ref
) {
  const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked)
  const isControlled = checked !== undefined
  const currentChecked = isControlled ? checked : uncontrolledChecked

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event)
      if (event.defaultPrevented || disabled) return

      const nextChecked = !currentChecked
      if (!isControlled) {
        setUncontrolledChecked(nextChecked)
      }
      onCheckedChange?.(nextChecked)
    },
    [currentChecked, disabled, isControlled, onCheckedChange, onClick]
  )

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={currentChecked}
      data-slot="switch"
      data-size={size}
      data-state={currentChecked ? 'checked' : 'unchecked'}
      data-disabled={disabled ? '' : undefined}
      className={cn(
        'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 group/switch inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6',
        className
      )}
      disabled={disabled}
      onClick={handleClick}
      {...props}
    >
      <span
        data-slot="switch-thumb"
        data-state={currentChecked ? 'checked' : 'unchecked'}
        className={cn(
          'bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block rounded-full ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0'
        )}
      />
      {children}
    </button>
  )
})

export { Switch }
