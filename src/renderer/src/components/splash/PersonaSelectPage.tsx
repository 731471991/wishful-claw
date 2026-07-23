import { useState, useCallback, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Check, ChevronDown, Loader2, Send, ShieldCheck, Sparkles, Users, Languages, Sun, Moon, Monitor, PenLine } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'
import { WindowControls } from '@renderer/components/layout/WindowControls'
import { useUIStore } from '@renderer/stores/ui-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { usePersonaStore } from '@renderer/stores/persona-store'
import type { PersonaSummary } from '@renderer/lib/persona/persona-types'
import { LANGUAGE_OPTIONS, detectSystemLanguage } from '@renderer/lib/i18n-language'
import { changeI18nLanguage } from '@renderer/locales'
import { cn } from '@renderer/lib/utils'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@renderer/components/ui/dropdown-menu'

type Step = 'setup' | 'persona'

const THEME_MODES = [
  { value: 'light', icon: Sun, label: '浅色' },
  { value: 'dark', icon: Moon, label: '深色' },
  { value: 'system', icon: Monitor, label: '跟随系统' }
] as const

export function PersonaSelectPage(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const enterMain = useUIStore((s) => s.enterMain)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const persistedName = useSettingsStore((s) => s.userName)
  const persistedTheme = useSettingsStore((s) => s.theme)
  const { setTheme } = useTheme()

  const { personas, loading, listPersonas } = usePersonaStore()
  const [step, setStep] = useState<Step>('setup')
  const [language, setLanguage] = useState(detectSystemLanguage())
  const [nickname, setNickname] = useState(persistedName ?? '')
  const [themeMode, setThemeMode] = useState<string>(persistedTheme ?? 'dark')
  const [selectedId, setSelectedId] = useState<string>('')
  const [finishing, setFinishing] = useState(false)

  const progress = step === 'setup' ? 50 : 100

  const canContinue = useMemo(() => {
    if (step === 'setup') return nickname.trim().length > 0
    if (step === 'persona') return Boolean(selectedId)
    return true
  }, [nickname, selectedId, step])

  // Apply language change immediately
  const handleLanguageChange = useCallback((lang: string) => {
    setLanguage(lang as typeof language)
    updateSettings({ language: lang })
    void changeI18nLanguage(lang)
  }, [updateSettings])

  // Apply theme mode change immediately
  const handleThemeModeChange = useCallback((mode: string) => {
    setThemeMode(mode)
    setTheme(mode)
    updateSettings({ theme: mode as 'light' | 'dark' | 'system' })
  }, [setTheme, updateSettings])

  // Load personas when entering persona step
  const handleEnterPersona = useCallback(() => {
    updateSettings({ userName: nickname.trim() })
    setStep('persona')
    if (personas.length === 0) {
      listPersonas()
    }
  }, [nickname, updateSettings, personas.length, listPersonas])

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
        <div className="w-full max-w-2xl">
          {/* Progress bar */}
          <div className="mb-8 h-1 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-foreground transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* ── Step 1: Setup (welcome + nickname + language + theme) ── */}
          {step === 'setup' && (
            <div className="space-y-8">
              {/* Welcome */}
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold">
                  {t('splash.welcome.title', { defaultValue: '欢迎使用 Wishful Claw' })}
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  {t('splash.welcome.subtitle', {
                    defaultValue: '不只是 AI 助手，更是你的编程搭档。本地运行，数据不出设备；融合多源工具链与可定制人格系统，让每次对话都有温度、有性格。你的代码、你的文件、你的节奏，全在掌控之中。'
                  })}
                </p>
              </div>

              {/* Nickname */}
              <div className="space-y-2">
                <div className="relative max-w-md">
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && nickname.trim()) handleEnterPersona()
                    }}
                    autoFocus
                    className="h-12 rounded-lg pl-10 pr-4 text-base font-medium shadow-sm"
                    placeholder={t('splash.nickname.placeholder', { defaultValue: '输入你的称呼' })}
                  />
                  <PenLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              {/* Language & Theme (compact dropdowns) */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {/* Language */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-sm outline-none cursor-pointer hover:bg-muted">
                      <Languages className="size-3.5" />
                      {LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language}
                      <ChevronDown className="size-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuRadioGroup
                      value={language}
                      onValueChange={handleLanguageChange}
                    >
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* Theme mode */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-sm outline-none cursor-pointer hover:bg-muted">
                      {(() => {
                        const CurrentIcon = THEME_MODES.find((m) => m.value === themeMode)?.icon ?? Sun
                        return <CurrentIcon className="size-3.5" />
                      })()}
                      {t(`splash.theme.modes.${themeMode}`, {
                        defaultValue: THEME_MODES.find((m) => m.value === themeMode)?.label ?? ''
                      })}
                      <ChevronDown className="size-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuRadioGroup
                      value={themeMode}
                      onValueChange={handleThemeModeChange}
                    >
                      {THEME_MODES.map((mode) => (
                        <DropdownMenuRadioItem key={mode.value} value={mode.value}>
                          {t(`splash.theme.modes.${mode.value}`, { defaultValue: mode.label })}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}

          {/* ── Step 2: Persona ── */}
          {step === 'persona' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold">
                  {t('splash.personaSelect.title', { defaultValue: '选择你喜欢的沟通角色' })}
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  {t('splash.personaSelect.subtitle', {
                    defaultValue: '不同角色有不同的性格和沟通风格，之后可以随时切换。'
                  })}
                </p>
              </div>

              {loading ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t('splash.personaSelect.loading', { defaultValue: '加载中...' })}
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
                <div className="grid max-h-[calc(100vh-340px)] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                  {personas.map((persona) => (
                    <PersonaCard
                      key={persona.id}
                      persona={persona}
                      selected={selectedId === persona.id}
                      onSelect={() => setSelectedId(persona.id)}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-end">
            {step === 'persona' ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setStep('setup')}
                  disabled={finishing}
                  className="text-muted-foreground"
                >
                  {t('splash.back', { defaultValue: '上一步' })}
                </Button>
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
              </div>
            ) : (
              <Button
                className="h-11 min-w-36 px-6"
                onClick={handleEnterPersona}
                disabled={!canContinue}
              >
                {t('splash.next', { defaultValue: '下一步' })}
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
  onSelect,
  t
}: {
  persona: PersonaSummary
  selected: boolean
  onSelect: () => void
  t: (key: string, opts?: { defaultValue?: string }) => string
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
            {t('splash.personaSelect.builtin', { defaultValue: '内置' })}
          </Badge>
        </div>
      )}
    </button>
  )
}
