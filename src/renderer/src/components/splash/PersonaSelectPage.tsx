import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, Check, Loader2, Send, ShieldCheck, Sparkles, PenLine, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'
import { WindowControls } from '@renderer/components/layout/WindowControls'
import { useUIStore } from '@renderer/stores/ui-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { usePersonaStore } from '@renderer/stores/persona-store'
import type { PersonaSummary } from '@renderer/lib/persona/persona-types'
import { cn } from '@renderer/lib/utils'

type Step = 'welcome' | 'nickname' | 'persona'

const STEPS: Step[] = ['welcome', 'nickname', 'persona']

export function PersonaSelectPage(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const enterMain = useUIStore((s) => s.enterMain)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const persistedName = useSettingsStore((s) => s.userName)

  const { personas, loading, listPersonas } = usePersonaStore()
  const [step, setStep] = useState<Step>('welcome')
  const [nickname, setNickname] = useState(persistedName ?? '')
  const [selectedId, setSelectedId] = useState<string>('')
  const [finishing, setFinishing] = useState(false)

  const stepIndex = STEPS.indexOf(step)
  const progress = ((stepIndex + 1) / STEPS.length) * 100

  const canContinue = useMemo(() => {
    if (step === 'nickname') return nickname.trim().length > 0
    if (step === 'persona') return Boolean(selectedId)
    return true
  }, [nickname, selectedId, step])

  // Load personas when entering persona step
  const handleEnterPersona = useCallback(() => {
    setStep('persona')
    if (personas.length === 0) {
      listPersonas()
    }
  }, [personas.length, listPersonas])

  // Auto-select default persona
  useMemo(() => {
    if (personas.length > 0 && !selectedId) {
      const defaultP = personas.find((p) => p.id === 'default') ?? personas[0]
      setSelectedId(defaultP.id)
    }
  }, [personas, selectedId])

  const goNext = useCallback(() => {
    if (step === 'welcome') {
      setStep('nickname')
    } else if (step === 'nickname') {
      updateSettings({ userName: nickname.trim() })
      handleEnterPersona()
    }
  }, [step, nickname, updateSettings, handleEnterPersona])

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }, [step])

  const handleFinish = useCallback(async () => {
    if (!selectedId) return
    setFinishing(true)
    try {
      updateSettings({
        defaultPersonaId: selectedId,
        onboardingCompleted: true,
        onboardingCompletedAt: Date.now()
      })
      toast.success(t('splash.personaSelect.saved', { defaultValue: '设置完成' }))
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
        <WindowControls />
      </header>

      {/* Main content */}
      <main className="flex min-h-0 flex-1 items-center justify-center px-5 py-8">
        <div className="w-full max-w-3xl">
          {/* Progress bar */}
          <div className="mb-8 h-1 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-foreground transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* ── Step: Welcome ── */}
          {step === 'welcome' && (
            <div className="max-w-xl space-y-8">
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold">
                  {t('splash.welcome.title', { defaultValue: '欢迎使用 Wishful Claw' })}
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  {t('splash.welcome.subtitle', {
                    defaultValue: '你的桌面 AI 助手。本地运行、隐私安全、人格可定制。花一分钟完成初始设置。'
                  })}
                </p>
              </div>
              <div className="space-y-5">
                {([
                  { icon: ShieldCheck, key: 'local', title: '本地运行', desc: '数据在你的设备上处理，断网也能用' },
                  { icon: Users, key: 'persona', title: '人格可定制', desc: '选择或创建不同性格的 AI 助手' },
                  { icon: Sparkles, key: 'powerful', title: '工具链完整', desc: '文件操作、代码编写、终端命令一站搞定' }
                ] as const).map((item) => (
                  <div key={item.key} className="grid grid-cols-[34px_1fr] gap-4">
                    <div className="flex size-8 items-center justify-center rounded-md border bg-background">
                      <item.icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold">
                        {t(`splash.welcome.points.${item.key}.title`, { defaultValue: item.title })}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {t(`splash.welcome.points.${item.key}.desc`, { defaultValue: item.desc })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step: Nickname ── */}
          {step === 'nickname' && (
            <div className="max-w-2xl space-y-7">
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold">
                  {t('splash.nickname.title', { defaultValue: '你叫什么？' })}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t('splash.nickname.subtitle', {
                    defaultValue: '让 AI 知道怎么称呼你。'
                  })}
                </p>
              </div>
              <div className="relative max-w-xl">
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nickname.trim()) goNext()
                  }}
                  autoFocus
                  className="h-14 rounded-lg pl-12 pr-4 text-lg font-medium shadow-sm"
                  placeholder={t('splash.nickname.placeholder', { defaultValue: '输入你的称呼' })}
                />
                <PenLine className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* ── Step: Persona ── */}
          {step === 'persona' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold">
                  {t('splash.personaSelect.title', { defaultValue: '选择你的人格' })}
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  {t('splash.personaSelect.subtitle', {
                    defaultValue: '不同人格有不同的性格和沟通风格，之后可以随时切换。'
                  })}
                </p>
              </div>

              {loading ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t('splash.personaSelect.loading', { defaultValue: '加载人格列表...' })}
                </div>
              ) : personas.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
                  <p className="text-sm font-medium">
                    {t('splash.personaSelect.empty', { defaultValue: '暂无可用人格' })}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => listPersonas()}>
                    {t('splash.personaSelect.retry', { defaultValue: '重试' })}
                  </Button>
                </div>
              ) : (
                <div className="grid max-h-[calc(100vh-320px)] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
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
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={stepIndex === 0 || finishing}
              className={cn('text-muted-foreground', stepIndex === 0 && 'invisible')}
            >
              <ArrowLeft className="size-4" />
              {t('splash.back', { defaultValue: '上一步' })}
            </Button>

            {step === 'persona' ? (
              <Button
                className="h-11 min-w-36 px-6"
                onClick={handleFinish}
                disabled={!canContinue || finishing}
              >
                {finishing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {t('splash.personaSelect.start', { defaultValue: '开始使用' })}
              </Button>
            ) : (
              <Button
                className="h-11 min-w-36 px-6"
                onClick={goNext}
                disabled={!canContinue}
              >
                {step === 'welcome'
                  ? t('splash.start', { defaultValue: '开始设置' })
                  : t('splash.next', { defaultValue: '下一步' })}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex h-8 shrink-0 items-center justify-center text-[11px] text-muted-foreground/50">
        Wishful Claw · v0.6.0-dev
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
        'min-h-24 rounded-lg border p-4 text-left transition-colors',
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
        <div className="mt-2">
          <Badge variant={selected ? 'secondary' : 'outline'} className="text-[10px]">
            内置
          </Badge>
        </div>
      )}
    </button>
  )
}
