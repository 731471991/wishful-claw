import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { BrainCircuit, ArrowRight, Settings, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { WindowControls } from '@renderer/components/layout/WindowControls'
import { useUIStore } from '@renderer/stores/ui-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { usePersonaStore } from '@renderer/stores/persona-store'
import type { PersonaSummary } from '@renderer/lib/persona/persona-types'
import { cn } from '@renderer/lib/utils'

export function PersonaSelectPage(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const enterMain = useUIStore((s) => s.enterMain)
  const openSettings = useUIStore((s) => s.openSettings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const { personas, loading, listPersonas } = usePersonaStore()
  const [selectedId, setSelectedId] = useState<string>('')
  const [finishing, setFinishing] = useState(false)

  useEffect(() => {
    listPersonas()
  }, [listPersonas])

  // Auto-select default persona
  useEffect(() => {
    if (personas.length > 0 && !selectedId) {
      const defaultP = personas.find((p) => p.id === 'default') ?? personas[0]
      setSelectedId(defaultP.id)
    }
  }, [personas, selectedId])

  const handleFinish = useCallback(async () => {
    if (!selectedId) return
    setFinishing(true)
    try {
      updateSettings({
        defaultPersonaId: selectedId,
        onboardingCompleted: true,
        onboardingCompletedAt: Date.now()
      })
      toast.success(t('splash.personaSelect.saved', { defaultValue: '人格已设置' }))
      enterMain()
    } finally {
      setFinishing(false)
    }
  }, [selectedId, updateSettings, enterMain, t])

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Title bar */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b bg-background/90 backdrop-blur">
        <div className="flex items-center px-3">
          <div className="text-sm font-semibold text-foreground">Wishful Claw</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => openSettings('provider')}
          >
            <Settings className="size-3.5" />
            {t('splash.enterSettings', { defaultValue: 'AI 服务商设置' })}
          </Button>
          <WindowControls />
        </div>
      </header>

      {/* Main content */}
      <main className="flex min-h-0 flex-1 items-center justify-center px-5 py-8">
        <div className="flex w-full max-w-3xl flex-col space-y-5">
          {/* Title & subtitle */}
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold">
              {t('splash.personaSelect.title', { defaultValue: '选择你的人格' })}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {t('splash.personaSelect.subtitle', {
                defaultValue: '选择一个 AI 人格作为你的默认助手。不同人格有不同的性格和沟通风格，之后可以随时切换。'
              })}
            </p>
          </div>

          {/* Persona cards */}
          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              {t('splash.personaSelect.loading', { defaultValue: '加载人格列表...' })}
            </div>
          ) : personas.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
              <BrainCircuit className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">
                {t('splash.personaSelect.empty', { defaultValue: '暂无可用人格' })}
              </p>
              <Button variant="outline" size="sm" onClick={() => listPersonas()}>
                {t('splash.personaSelect.retry', { defaultValue: '重试' })}
              </Button>
            </div>
          ) : (
            <div className="grid max-h-[calc(100vh-280px)] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {personas.map((persona) => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  selected={selectedId === persona.id}
                  onSelect={() => setSelectedId(persona.id)}
                />
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="flex shrink-0 items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground/60">
              {t('splash.personaSelect.hint', { defaultValue: '可以在设置中随时修改或创建新人格' })}
            </p>
            <Button
              className="h-11 min-w-36 px-6"
              onClick={handleFinish}
              disabled={!selectedId || finishing}
            >
              {finishing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              {t('splash.personaSelect.start', { defaultValue: '开始使用' })}
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex h-10 shrink-0 items-center justify-center border-t text-[11px] text-muted-foreground/50">
        Wishful Claw · v0.2.0-dev
      </footer>
    </div>
  )
}

function PersonaCard({
  persona,
  selected,
  onSelect
}: {
  persona: PersonaSummary
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'min-h-28 rounded-lg border p-4 text-left transition-colors',
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'bg-background hover:bg-muted'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{persona.name}</h2>
          {persona.tagline && (
            <p
              className={cn(
                'mt-1 line-clamp-1 text-xs',
                selected ? 'text-background/75' : 'text-muted-foreground'
              )}
            >
              {persona.tagline}
            </p>
          )}
          {persona.description && (
            <p
              className={cn(
                'mt-1.5 line-clamp-2 text-xs leading-5',
                selected ? 'text-background/60' : 'text-muted-foreground/70'
              )}
            >
              {persona.description}
            </p>
          )}
        </div>
        {selected ? <Check className="size-5 shrink-0" /> : null}
      </div>
      {persona.isBuiltin && (
        <div className="mt-3">
          <Badge variant={selected ? 'secondary' : 'outline'} className="text-[10px]">
            内置
          </Badge>
        </div>
      )}
    </button>
  )
}
