import { User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@renderer/components/ui/badge'
import { Spinner } from '@renderer/components/ui/spinner'
import type { PersonaSummary } from '@renderer/lib/persona/persona-types'
import { cn } from '@renderer/lib/utils'

interface PersonaListProps {
  personas: PersonaSummary[]
  loading: boolean
  selectedId: string
  isNew: boolean
  onSelect: (id: string) => void
}

export function PersonaList({
  personas,
  loading,
  selectedId,
  isNew,
  onSelect
}: PersonaListProps): React.JSX.Element {
  const { t } = useTranslation('settings')

  if (loading && personas.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-5" />
      </div>
    )
  }

  if (personas.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
        {t('persona.empty', { defaultValue: '暂无人格' })}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {personas.map((p) => {
        const isActive = selectedId === p.id && !isNew
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={cn(
              'group flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
            )}
          >
            <div className="flex items-center gap-2">
              <User className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {p.name}
              </span>
              {p.isBuiltin && (
                <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                  {t('persona.builtin', { defaultValue: '内置' })}
                </Badge>
              )}
            </div>
            {p.tagline && (
              <p className="truncate pl-5 text-[11px] text-muted-foreground/70">
                {p.tagline}
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}
