import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Check, Search } from 'lucide-react'
import { useProviderStore } from '@renderer/stores/provider-store'
import { cn } from '@renderer/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import type { AIProvider } from '@shared/types/provider'

export function ModelSwitcher(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [hoveredProviderId, setHoveredProviderId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const providers = useProviderStore((s) => s.providers)
  const activeProviderId = useProviderStore((s) => s.activeProviderId)
  const defaultModel = useProviderStore((s) => s.defaultModel)
  const setActiveProvider = useProviderStore((s) => s.setActiveProvider)
  const setDefaultModel = useProviderStore((s) => s.setDefaultModel)

  // Resolve current display provider + model
  const displayProvider = useMemo(
    () => providers.find((p) => p.id === activeProviderId) ?? providers[0] ?? null,
    [providers, activeProviderId]
  )
  const displayModel = useMemo(
    () =>
      displayProvider?.models.find((m) => m.id === defaultModel) ??
      displayProvider?.models.find((m) => m.enabled) ??
      null,
    [displayProvider, defaultModel]
  )

  // Build provider groups (only enabled providers with enabled chat models)
  const groups = useMemo(() => {
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

  // Which provider's models to show in the right panel
  const activeGroupProviderId = hoveredProviderId ?? groups[0]?.provider.id ?? null
  const activeGroup = useMemo(
    () => groups.find((g) => g.provider.id === activeGroupProviderId) ?? null,
    [groups, activeGroupProviderId]
  )

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setHoveredProviderId(null)
    }
  }, [])

  // Focus search on open; reset state
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setSearch('')
      setHoveredProviderId(null)
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

  return (
    <div className="inline-flex h-8 items-center">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label={triggerLabel}
          >
            <span className="size-2 rounded-full bg-primary/70 shrink-0" />
            <span className="truncate max-w-[140px] font-medium">{triggerLabel}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border/70 bg-popover p-0 shadow-2xl"
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

          {groups.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground/50">
              No providers configured. Open Settings to add a provider.
            </div>
          ) : (
            /* Two-column layout: providers | models */
            <div className="flex max-h-[360px]">
              {/* Left: Provider list */}
              <div className="w-36 shrink-0 overflow-y-auto border-r py-1">
                {groups.map(({ provider, models }) => {
                  const isActive =
                    provider.id === (displayProvider?.id ?? activeProviderId)
                  const isHovered = provider.id === activeGroupProviderId
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors',
                        isHovered
                          ? 'bg-muted/70'
                          : 'hover:bg-muted/40'
                      )}
                      onMouseEnter={() => setHoveredProviderId(provider.id)}
                      onClick={() => setHoveredProviderId(provider.id)}
                    >
                      <span className="size-4 rounded-sm bg-muted/60 shrink-0" />
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-xs font-medium',
                          isActive ? 'text-primary' : 'text-foreground/80'
                        )}
                      >
                        {provider.name}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground/50">
                        {models.length}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Right: Model list for hovered/selected provider */}
              <div className="min-w-0 flex-1 overflow-y-auto py-1">
                {activeGroup?.models.map((m) => {
                  const isActive =
                    activeGroup.provider.id === (displayProvider?.id ?? activeProviderId) &&
                    m.id === (defaultModel ?? displayModel?.id)
                  return (
                    <button
                      key={`${activeGroup.provider.id}-${m.id}`}
                      className={cn(
                        'flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-muted/50',
                        isActive && 'bg-primary/5'
                      )}
                      onClick={() => selectModel(activeGroup.provider, m.id)}
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
                              : 'text-foreground/80'
                          )}
                        >
                          {m.name || m.id}
                        </span>
                        {/* Capability tags */}
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
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
