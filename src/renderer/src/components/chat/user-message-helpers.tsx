import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { Sparkles } from 'lucide-react'




export function ActionIconButton({
  label,
  icon,
  onClick,
  danger = false
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={`flex size-7 items-center justify-center rounded-md border border-border/50 bg-background/80 text-muted-foreground transition-colors hover:bg-muted/80 ${danger ? 'hover:text-destructive' : 'hover:text-foreground'}`}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

export const USER_MESSAGE_WIDTH_CLASS = 'w-full max-w-[min(82%,42rem)]'
export const USER_MESSAGE_BUBBLE_CLASS =
  'rounded-[18px] border border-border/60 bg-muted/35 px-4 py-3 text-sm text-foreground shadow-sm dark:bg-muted/70'
const SKILL_DIRECTIVE_RE = /^\s*\[Skill:\s*([^\]\n]+?)\s*\]\s*(?:\r?\n)?([\s\S]*)$/

interface UserSkillDirective {
  name: string
  body: string
}

export function parseUserSkillDirective(text: string): UserSkillDirective | null {
  const match = SKILL_DIRECTIVE_RE.exec(text)
  if (!match) return null
  const name = match[1]?.trim()
  if (!name) return null
  return {
    name,
    body: (match[2] ?? '').trimStart()
  }
}

export function serializeUserSkillDirective(name: string, body: string): string {
  const trimmedBody = body.trim()
  return trimmedBody ? `[Skill: ${name}]\n${trimmedBody}` : `[Skill: ${name}]`
}

export function UserSkillBadge({ name }: { name: string }): React.JSX.Element {
  const { t } = useTranslation('chat')
  return (
    <div className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300">
      <Sparkles className="size-3 shrink-0" />
      <span className="shrink-0 font-medium">{t('userMessage.skillLabel')}</span>
      <span className="min-w-0 truncate font-mono" title={name}>
        {name}
      </span>
    </div>
  )
}

