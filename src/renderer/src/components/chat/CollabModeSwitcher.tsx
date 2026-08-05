import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, MessageSquare, Target } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { cn } from '@renderer/lib/utils'
import { useUIStore } from '@renderer/stores/ui-store'

export type CollabMode = 'normal' | 'goal'

interface CollabModeOption {
  value: CollabMode
  label: string
  description: string
  icon: React.ReactNode
}

function getModeOptions(t: (key: string, opts?: any) => string): CollabModeOption[] {
  return [
    {
      value: 'normal',
      label: t('collab.mode.normal', { defaultValue: '常规' }),
      description: t('collab.mode.normalDesc', {
        defaultValue: '普通聊天，可开启 Plan 模式'
      }),
      icon: <MessageSquare className="size-3.5" />
    },
    {
      value: 'goal',
      label: t('collab.mode.goal', { defaultValue: '目标' }),
      description: t('collab.mode.goalDesc', {
        defaultValue: 'Goal 模式，设定目标后自主执行'
      }),
      icon: <Target className="size-3.5" />
    }
  ]
}

interface CollabModeSwitcherProps {
  sessionId?: string | null
  /** Override mode (used for pending state when session not yet created) */
  modeOverride?: CollabMode
  disabled?: boolean
  onModeChange?: (mode: CollabMode) => void
}

export function CollabModeSwitcher({
  sessionId,
  modeOverride,
  disabled = false,
  onModeChange
}: CollabModeSwitcherProps): React.JSX.Element {
  const { t } = useTranslation('chat')
  const [open, setOpen] = React.useState(false)
  const storeMode = useUIStore((s) =>
    sessionId ? (s.collabModesBySession[sessionId] ?? 'normal') : 'normal'
  )
  const derivedMode = modeOverride ?? storeMode
  // Local mode: initially synced with derivedMode, then independent after user selection
  const [localMode, setLocalMode] = React.useState<CollabMode>(derivedMode)
  const mode = localMode
  const setCollabMode = useUIStore((s) => s.setCollabMode)
  const options = getModeOptions(t)
  const activeOption = options.find((o) => o.value === mode) ?? options[0]

  const handleSelect = (nextMode: CollabMode): void => {
    if (nextMode === mode) {
      setOpen(false)
      return
    }
    setLocalMode(nextMode) // Immediately update local state for instant UI feedback
    if (sessionId) {
      setCollabMode(sessionId, nextMode)
    }
    onModeChange?.(nextMode)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-tour="collab-mode-switch"
          className="group h-8 gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
          disabled={disabled}
        >
          <span className="text-primary">{activeOption.icon}</span>
          <span className="font-medium">{activeOption.label}</span>
          <ChevronDown className="size-3 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-1.5" sideOffset={4}>
        {options.map((option) => {
          const active = option.value === mode
          return (
            <DropdownMenuItem
              key={option.value}
              className={cn(
                'group items-start gap-2.5 rounded-lg px-2 py-2',
                active && 'bg-accent/50 focus:bg-accent'
              )}
              onSelect={() => handleSelect(option.value)}
            >
              <span
                className={cn(
                  'mt-px flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors',
                  active
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border/60 bg-muted/40 text-muted-foreground group-focus:text-foreground'
                )}
              >
                {option.icon}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-[13px] font-medium leading-none text-foreground">
                  {option.label}
                  {active ? <Check className="size-3.5 text-primary" strokeWidth={2.5} /> : null}
                </span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
