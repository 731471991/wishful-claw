import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Check, Search, ChevronRight } from 'lucide-react'
import { useProviderStore } from '@renderer/stores/provider-store'
import { cn } from '@renderer/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import type { AIProvider, AIModelConfig } from '@shared/types/provider'

interface ProviderGroup {
  provider: AIProvider
  models: AIModelConfig[]
}

export function ModelSwitcher(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const providers = useProviderStore((s) => s.providers)
  const activeProviderId = useProviderStore((s) => s.activeProviderId)
  const defaultModel = useProviderStore((s) => s.defaultModel)
  const setActiveProvider = useProviderStore((s) => s.setActiveProvider)
  const setDefaultModel = useProviderStore((s) => s.setDefaultModel)

  // Resolve current display model
  const displayProvider = useMemo(
    () => providers.find((p) => p.id === activeProviderId) ?? providers[0] ?? null,
    [providers, activeProviderId]
  )
  const displayModel = useMemo(
    () => displayProvider?.models.find((m) => m.id === defaultModel) ?? displayProvider?.models.find((m) => m.enabled) ?? null,
    [displayProvider, defaultModel]
  )

  // Build provider groups (only enabled providers with enabled models)
  const groups = useMemo<ProviderGroup[]>(() => {
    if (!open) return []
    const q = search.toLowerCase().trim()
    return providers
      .filter((p) => p.enabled)
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
  }, [providers, open, search])

  const selectedGroup = useMemo(
    () =>
      selectedProviderId
        ? (groups.find((g) => g.provider.id === selectedProviderId) ?? null)
        : null,
    [groups, selectedProviderId]
  )

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    setSelectedProviderId(null)
  }, [])

  // Focus search on open
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setSearch('')
      searchRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [open])

  const selectModel = useCallback(
    (provider: AIProvider, modelId: string) => {
      if (provider.id !== activeProviderId) setActiveProvider(provider.id)
      if (modelId !== defaultModel) setDefaultModel(modelId)
      setOpen(false)
    },
    [activeProviderId, defaultModel, setActiveProvider, setDefaultModel]
  )

  const triggerLabel = displayModel?.name ?? displayModel?.id ?? 'Select model'
  const triggerProviderName = displayProvider?.name ?? null

  return (
    <div className="inline-flex h-8 items-center rounded-lg border border-transparent hover:border-border/50 hover:bg-muted/30 transition-colors">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label={triggerLabel}
          >
            <span className="size-2 rounded-full bg-primary/70 shrink-0" />
            <span className="truncate max-w-[140px] font-medium">{triggerLabel}</span>
            {triggerProviderName && (
              <span className="hidden text-[10px] text-muted-foreground/50 sm:inline">
                {triggerProviderName}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 max-w-[calc(100vw-2rem)] overflow-visible p-0"
          align="start"
          sideOffset={8}
        >
          {/* Search bar */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-3.5 text-muted-foreground/60 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40"
              placeholder="Search model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Provider list */}
          <div className="p-1">
            <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Providers
            </div>
            <div className="max-h-[328px] overflow-y-auto">
              {groups.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground/50">
                  No providers configured
                </div>
              ) : (
                groups.map(({ provider, models }) => {
                  const isSelected = provider.id === selectedGroup?.provider.id
                  const isDisplayProvider =
                    provider.id === (displayProvider?.id ?? activeProviderId)
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
                          onMouseEnter={() => setSelectedProviderId(provider.id)}
                          onClick={() => setSelectedProviderId(provider.id)}
                        >
                          <span className="size-4 rounded-sm bg-muted/60 shrink-0" />
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
                          <ChevronRight className="size-3 shrink-0 text-muted-foreground/40" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-72 max-w-[calc(100vw-2rem)] overflow-hidden p-1"
                        align="start"
                        side="right"
                        sideOffset={6}
                      >
                        <div className="sticky top-0 z-10 mb-1 flex items-center gap-2 border-b bg-popover/95 px-2 py-1.5 backdrop-blur">
                          <span className="min-w-0 flex-1 truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                            {provider.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground/50">
                            {models.length} models
                          </span>
                        </div>
                        <div className="max-h-[344px] overflow-y-auto">
                          {models.map((m) => {
                            const isActive =
                              provider.id === (displayProvider?.id ?? activeProviderId) &&
                              m.id === (defaultModel ?? displayModel?.id)
                            return (
                              <button
                                key={`${provider.id}-${m.id}`}
                                className={cn(
                                  'flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60 group',
                                  isActive && 'bg-primary/5'
                                )}
                                onClick={() => selectModel(provider, m.id)}
                              >
                                <span className="mt-0.5 shrink-0">
                                  {isActive ? (
                                    <span className="flex size-5 items-center justify-center rounded-full bg-primary/10">
                                      <Check className="size-3 text-primary" />
                                    </span>
                                  ) : (
                                    <span className="size-5 rounded-full border border-muted-foreground/20" />
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
                                    {m.name || m.id}
                                  </span>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {m.supportsVision && (
                                      <span className="rounded-sm bg-emerald-500/10 px-1 py-px text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                                        Vision
                                      </span>
                                    )}
                                    {m.supportsFunctionCall && (
                                      <span className="rounded-sm bg-blue-500/10 px-1 py-px text-[9px] font-medium text-blue-600 dark:text-blue-400">
                                        Tools
                                      </span>
                                    )}
                                    {m.supportsThinking && (
                                      <span className="rounded-sm bg-violet-500/10 px-1 py-px text-[9px] font-medium text-violet-600 dark:text-violet-400">
                                        Thinking
                                      </span>
                                    )}
                                    {m.contextLength && (
                                      <span className="rounded-sm bg-muted/60 px-1 py-px text-[9px] font-medium text-muted-foreground">
                                        {m.contextLength >= 1_000_000
                                          ? `${(m.contextLength / 1_000_000).toFixed(m.contextLength % 1_000_000 === 0 ? 0 : 1)}M`
                                          : `${Math.round(m.contextLength / 1_000)}K`}
                                      </span>
                                    )}
                                  </div>
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
