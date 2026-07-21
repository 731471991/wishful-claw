import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Check, Search } from 'lucide-react'
import {
  isProviderAvailableForModelSelection,
  useProviderStore,
  modelSupportsVision
} from '@renderer/stores/provider-store'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@renderer/components/ui/hover-card'
import { ProviderIcon, ModelIcon } from '@renderer/components/settings/provider-icons'
import { cn } from '@renderer/lib/utils'
import type { AIProvider, AIModelConfig } from '@shared/types/provider'
import { useTranslation } from 'react-i18next'

// ─── Helpers (from OpenCowork) ───

function formatContextLength(length?: number): string | null {
  if (!length) return null
  if (length >= 1_000_000)
    return `${(length / 1_000_000).toFixed(length % 1_000_000 === 0 ? 0 : 1)}M`
  if (length >= 1_000) return `${Math.round(length / 1_000)}K`
  return String(length)
}

function selectModel(
  provider: AIProvider,
  modelId: string,
  setOpen: (v: boolean) => void
): void {
  const pid = provider.id
  const providerStore = useProviderStore.getState()
  if (pid !== providerStore.activeProviderId) providerStore.setActiveProvider(pid)
  providerStore.setActiveModel(modelId)
  setOpen(false)
}

// ─── Capability tags (simplified from OpenCowork) ───

function ModelCapabilityTags({
  model,
  providerType,
  t,
  showContext = true
}: {
  model: AIModelConfig
  providerType?: AIProvider['type']
  t: (key: string, opts?: Record<string, unknown>) => string
  showContext?: boolean
}): React.JSX.Element {
  const ctx = formatContextLength(model.contextLength)
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {modelSupportsVision(model, providerType) && (
        <span className="inline-flex items-center gap-0.5 rounded-sm bg-emerald-500/10 px-1 py-px text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
          {t('topbar.vision', { defaultValue: 'Vision' })}
        </span>
      )}
      {model.supportsFunctionCall && (
        <span className="inline-flex items-center gap-0.5 rounded-sm bg-blue-500/10 px-1 py-px text-[9px] font-medium text-blue-600 dark:text-blue-400">
          {t('topbar.tools', { defaultValue: 'Tools' })}
        </span>
      )}
      {model.supportsThinking && (
        <span className="inline-flex items-center gap-0.5 rounded-sm bg-violet-500/10 px-1 py-px text-[9px] font-medium text-violet-600 dark:text-violet-400">
          {t('topbar.thinking', { defaultValue: 'Thinking' })}
        </span>
      )}
      {showContext && ctx && (
        <span className="inline-flex items-center rounded-sm bg-muted/60 px-1 py-px text-[9px] font-medium text-muted-foreground">
          {ctx}
        </span>
      )}
    </div>
  )
}

// ─── Provider group type ───

interface ProviderGroup {
  provider: AIProvider
  models: AIModelConfig[]
}

// ─── Main ModelSwitcher (from OpenCowork, simplified) ───
//
// Removed from OpenCowork version:
// - Auto model selection / routing
// - Fast route model selection
// - Session-level model override (sessionId prop)
// - Quota indicators (codex/copilot)
// - Settings popover (thinking, fast mode, cache TTL, builtin search, websocket)
// - Reasoning effort slider
// - Channel store integration

export function ModelSwitcher(): React.JSX.Element {
  const { t } = useTranslation('layout')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const activeModelRef = useRef<HTMLButtonElement>(null)
  const hasAutoScrolledToSelectionRef = useRef(false)

  const activeProviderId = useProviderStore((s) => s.activeProviderId)
  const activeModelId = useProviderStore((s) => s.activeModelId)
  const providers = useProviderStore((s) => s.providers)

  const enabledProviders = useMemo(
    () => (open ? providers.filter((p) => isProviderAvailableForModelSelection(p)) : []),
    [open, providers]
  )

  // Resolve display provider + model
  const displayProviderId = activeProviderId ?? providers[0]?.id ?? null
  const displayProvider = providers.find((p) => p.id === displayProviderId)
  const displayModelId = activeModelId || displayProvider?.defaultModel || ''
  const displayModel = displayProvider?.models.find((m) => m.id === displayModelId)

  const triggerLabel = displayModel?.name ?? displayModelId ?? t('topbar.noModel', { defaultValue: 'Select model' })
  const triggerProviderName = displayProvider?.name ?? null

  const groups = useMemo<ProviderGroup[]>(() => {
    if (!open) return []
    const q = search.toLowerCase().trim()
    return enabledProviders
      .map((provider) => {
        const models = provider.models.filter((m) => {
          if (!m.enabled) return false
          if ((m.category ?? 'chat') !== 'chat') return false
          if (!q) return true
          const name = (m.name || m.id).toLowerCase()
          return name.includes(q) || provider.name.toLowerCase().includes(q)
        })
        return { provider, models }
      })
      .filter((g) => g.models.length > 0)
  }, [enabledProviders, open, search])

  const selectedGroup = useMemo(
    () =>
      selectedProviderId
        ? (groups.find((group) => group.provider.id === selectedProviderId) ?? null)
        : null,
    [groups, selectedProviderId]
  )

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    setSelectedProviderId(null)
  }, [])

  useEffect(() => {
    if (!open) {
      hasAutoScrolledToSelectionRef.current = false
      return
    }
    const timer = setTimeout(() => {
      setSearch('')
      searchRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [open])

  // Auto-scroll to active model
  useEffect(() => {
    if (
      !open ||
      !selectedGroup ||
      search.trim() ||
      hasAutoScrolledToSelectionRef.current
    ) {
      return
    }
    const timer = setTimeout(() => {
      const target = activeModelRef.current
      const container = listRef.current
      if (!target || !container) return
      const containerRect = container.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const offsetTop = targetRect.top - containerRect.top + container.scrollTop
      const scrollTop = offsetTop - container.clientHeight / 2 + targetRect.height / 2
      container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'auto' })
      hasAutoScrolledToSelectionRef.current = true
    }, 0)
    return () => clearTimeout(timer)
  }, [open, search, selectedGroup])

  return (
    <div className="inline-flex h-8 items-center rounded-lg border border-transparent hover:border-border/50 hover:bg-muted/30 transition-colors">
      {/* Model icon trigger — opens model list */}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <HoverCard openDelay={180} closeDelay={100}>
          <HoverCardTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                aria-label={triggerLabel}
              >
                <ModelIcon
                  icon={displayModel?.icon}
                  modelId={displayModelId || undefined}
                  providerBuiltinId={displayProvider?.builtinId}
                  size={20}
                />
              </button>
            </PopoverTrigger>
          </HoverCardTrigger>
          <HoverCardContent side="top" align="start" className="w-72 p-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/45">
                <ModelIcon
                  icon={displayModel?.icon}
                  modelId={displayModelId || undefined}
                  providerBuiltinId={displayProvider?.builtinId}
                  size={20}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{triggerLabel}</div>
                {triggerProviderName && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {triggerProviderName}
                  </div>
                )}
              </div>
            </div>
            {displayModel && (
              <div className="mt-2 border-t border-border/60 pt-2">
                <ModelCapabilityTags
                  model={displayModel}
                  providerType={displayProvider?.type}
                  t={t}
                  showContext={false}
                />
              </div>
            )}
          </HoverCardContent>
        </HoverCard>
        <PopoverContent
          className="w-64 max-w-[calc(100vw-2rem)] overflow-visible p-0"
          align="start"
          sideOffset={8}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-3.5 text-muted-foreground/60 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40"
              placeholder={t('topbar.searchModel', { defaultValue: 'Search model...' })}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="p-1">
            <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              {t('topbar.providers', { defaultValue: 'Providers' })}
            </div>
            <div className="max-h-[328px] overflow-y-auto">
              {groups.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground/50">
                  {enabledProviders.length === 0
                    ? t('topbar.noProviders', { defaultValue: 'No providers configured' })
                    : t('topbar.noModels', { defaultValue: 'No models found' })}
                </div>
              ) : (
                groups.map(({ provider, models }) => {
                  const isSelected = provider.id === selectedGroup?.provider.id
                  const isDisplayProvider = provider.id === displayProviderId
                  return (
                    <Popover
                      key={provider.id}
                      open={selectedProviderId === provider.id}
                      onOpenChange={(nextOpen) => {
                        if (nextOpen) setSelectedProviderId(provider.id)
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/70',
                            isSelected && 'bg-background shadow-sm',
                            isDisplayProvider && !isSelected && 'text-primary'
                          )}
                          onFocus={() => setSelectedProviderId(provider.id)}
                          onMouseEnter={() => setSelectedProviderId(provider.id)}
                          onClick={() => setSelectedProviderId(provider.id)}
                        >
                          <ProviderIcon builtinId={provider.builtinId} size={16} />
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">
                            {provider.name}
                          </span>
                          <span
                            className={cn(
                              'rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground',
                              isDisplayProvider && 'bg-primary/10 text-primary'
                            )}
                          >
                            {models.length}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-1"
                        align="start"
                        side="right"
                        sideOffset={6}
                      >
                        <div className="sticky top-0 z-10 mb-1 flex items-center gap-2 border-b bg-popover/95 px-2 py-1.5 backdrop-blur">
                          <ProviderIcon builtinId={provider.builtinId} size={14} />
                          <span className="min-w-0 flex-1 truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                            {provider.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground/50">
                            {t('topbar.modelsCount', { count: models.length, defaultValue: '{{count}} models' })}
                          </span>
                        </div>
                        <div
                          ref={selectedProviderId === provider.id ? listRef : undefined}
                          className="max-h-[344px] overflow-y-auto"
                        >
                          {models.map((m) => {
                            const isActive =
                              provider.id === displayProviderId && m.id === displayModelId
                            return (
                              <button
                                key={`${provider.id}-${m.id}`}
                                ref={isActive ? activeModelRef : undefined}
                                className={cn(
                                  'flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60 group',
                                  isActive && 'bg-primary/5'
                                )}
                                onClick={() => selectModel(provider, m.id, setOpen)}
                              >
                                <span className="mt-0.5 shrink-0">
                                  {isActive ? (
                                    <span className="flex size-5 items-center justify-center rounded-full bg-primary/10">
                                      <Check className="size-3 text-primary" />
                                    </span>
                                  ) : (
                                    <ModelIcon
                                      icon={m.icon}
                                      modelId={m.id}
                                      providerBuiltinId={provider.builtinId}
                                      size={20}
                                    />
                                  )}
                                </span>
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <span
                                    className={cn(
                                      'truncate text-xs',
                                      isActive
                                        ? 'font-semibold text-primary'
                                        : 'text-foreground/80 group-hover:text-foreground'
                                    )}
                                  >
                                    {m.name || m.id.replace(/-\d{8}$/, '')}
                                  </span>
                                  <ModelCapabilityTags
                                    model={m}
                                    providerType={provider.type}
                                    t={t}
                                  />
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
