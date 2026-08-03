import { useCallback } from 'react'
import { Check, Brain, Settings2 } from 'lucide-react'
import {
  useProviderStore,
  modelSupportsBuiltinSearch,
  modelSupportsResponsesWebsocket,
  modelSupportsResponsesImageGeneration
} from '@renderer/stores/provider-store'
import {
  useSettingsStore,
  getReasoningEffortKey,
  resolveReasoningEffortForModel
} from '@renderer/stores/settings-store'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { cn } from '@renderer/lib/utils'
import type {
  AIModelConfig,
  AIProvider,
  ReasoningEffortLevel
} from '@shared/types/provider'
import { isResponsesImageGenerationEnabled } from '@renderer/lib/api/responses-image-generation'
import { ReasoningEffortSlider } from '../ReasoningEffortSlider'
import { SettingSection, PillToggle } from './primitives'
import {
  MIN_ANTHROPIC_THINKING_BUDGET, DEFAULT_ANTHROPIC_THINKING_BUDGET,
  clampThinkingBudget, readAnthropicThinkingBudget,
  buildAnthropicThinkingConfigWithBudget,
  supportsPriorityServiceTier
} from './utils'

/**
 * Model settings popover: thinking, fast mode, websocket, image generation,
 * cache TTL, builtin search toggles.
 * Extracted from ModelSwitcher.tsx for code splitting (AGENTS.md compliance).
 */
export function ModelSettingsPopover({
  model,
  providerId,
  providerType,
  providerWebsocketMode,
  side = 'top',
  t,
  tChat,
  tSettings
}: {
  model: AIModelConfig | undefined
  providerId?: string | null
  providerType?: AIProvider['type']
  providerWebsocketMode?: AIProvider['websocketMode']
  side?: 'top' | 'bottom'
  t: (key: string) => string
  tChat: (key: string, opts?: Record<string, unknown>) => string
  tSettings: (key: string, opts?: Record<string, unknown>) => string
}): React.JSX.Element | null {
  const requestType = model?.type ?? providerType
  const supportsThinking = model?.supportsThinking ?? false
  const supportsFastMode = supportsPriorityServiceTier(model)
  const supportsResponsesWebsocket = modelSupportsResponsesWebsocket(model, providerType)
  const supportsResponsesImageGeneration = modelSupportsResponsesImageGeneration(
    model,
    providerType
  )
  const levels = model?.thinkingConfig?.reasoningEffortLevels
  const thinkingEnabled = useSettingsStore((s) => s.thinkingEnabled)
  const fastModeEnabled = useSettingsStore((s) => s.fastModeEnabled)
  const reasoningEffort = useSettingsStore((s) => s.reasoningEffort)
  const reasoningEffortByModel = useSettingsStore((s) => s.reasoningEffortByModel)
  const effortKey = getReasoningEffortKey(providerId, model?.id)
  const effectiveReasoningEffort = resolveReasoningEffortForModel({
    reasoningEffort,
    reasoningEffortByModel,
    providerId,
    modelId: model?.id,
    thinkingConfig: model?.thinkingConfig
  })

  const toggleThinking = useCallback(() => {
    const store = useSettingsStore.getState()
    if (!store.thinkingEnabled && levels) {
      store.updateSettings({ thinkingEnabled: true, reasoningEffort: effectiveReasoningEffort })
    } else {
      store.updateSettings({ thinkingEnabled: !store.thinkingEnabled })
    }
  }, [levels, effectiveReasoningEffort])

  const setEffort = useCallback(
    (level: ReasoningEffortLevel) => {
      const store = useSettingsStore.getState()
      store.updateSettings({
        reasoningEffort: level,
        reasoningEffortByModel: effortKey
          ? { ...store.reasoningEffortByModel, [effortKey]: level }
          : store.reasoningEffortByModel,
        thinkingEnabled: true
      })
    },
    [effortKey]
  )

  const supportsAnthropicCacheTtl = requestType === 'anthropic'
  const anthropicCacheTtl = model?.cacheTtl ?? '5m'

  const supportsBuiltinSearch = modelSupportsBuiltinSearch(model, providerType)
  const builtinSearchEnabled = supportsBuiltinSearch && model?.enableBuiltinSearch === true

  const hasConfigControls =
    supportsThinking ||
    supportsFastMode ||
    supportsResponsesWebsocket ||
    supportsResponsesImageGeneration ||
    supportsAnthropicCacheTtl ||
    supportsBuiltinSearch

  const supportsAnthropicThinkingBudget =
    supportsThinking && requestType === 'anthropic' && !!model?.thinkingConfig
  const thinkingBudgetMax = Math.max(
    MIN_ANTHROPIC_THINKING_BUDGET,
    Math.floor((model?.maxOutputTokens ?? 64_000) - 1)
  )
  const thinkingBudget = clampThinkingBudget(
    readAnthropicThinkingBudget(model) ?? DEFAULT_ANTHROPIC_THINKING_BUDGET,
    model?.maxOutputTokens
  )

  const updateAnthropicThinkingBudget = useCallback(
    (value: number) => {
      if (!model?.id) return
      const budget = clampThinkingBudget(value, model.maxOutputTokens)
      const providerStore = useProviderStore.getState()
      const targetProviderId = providerId ?? providerStore.activeProviderId
      if (!targetProviderId) return

      providerStore.updateModel(targetProviderId, model.id, {
        supportsThinking: true,
        thinkingConfig: buildAnthropicThinkingConfigWithBudget(model.thinkingConfig, budget)
      })
      useSettingsStore.getState().updateSettings({ thinkingEnabled: true })
    },
    [model, providerId]
  )

  const updateAnthropicCacheTtl = useCallback(
    (ttl: '5m' | '1h') => {
      if (!model?.id) return
      const providerStore = useProviderStore.getState()
      const targetProviderId = providerId ?? providerStore.activeProviderId
      if (!targetProviderId) return
      providerStore.updateModel(targetProviderId, model.id, { cacheTtl: ttl })
    },
    [model, providerId]
  )

  const toggleBuiltinSearch = useCallback(() => {
    if (!model?.id) return
    const providerStore = useProviderStore.getState()
    const targetProviderId = providerId ?? providerStore.activeProviderId
    if (!targetProviderId) return
    providerStore.updateModel(targetProviderId, model.id, {
      enableBuiltinSearch: !builtinSearchEnabled
    })
  }, [model, providerId, builtinSearchEnabled])

  const websocketEnabled =
    (model?.websocketMode ?? providerWebsocketMode ?? 'disabled') !== 'disabled'
  const responsesImageGenerationEnabled = isResponsesImageGenerationEnabled(
    model?.responsesImageGeneration
  )

  const toggleResponsesWebsocket = useCallback(() => {
    if (!model?.id) return
    const providerStore = useProviderStore.getState()
    const targetProviderId = providerId ?? providerStore.activeProviderId
    if (!targetProviderId) return
    providerStore.updateModel(targetProviderId, model.id, {
      websocketMode: websocketEnabled ? 'disabled' : 'auto'
    })
  }, [model, providerId, websocketEnabled])

  const toggleResponsesImageGeneration = useCallback(() => {
    if (!model?.id) return
    const providerStore = useProviderStore.getState()
    const targetProviderId = providerId ?? providerStore.activeProviderId
    if (!targetProviderId) return
    providerStore.updateModel(targetProviderId, model.id, {
      responsesImageGeneration: {
        ...(model.responsesImageGeneration ?? {}),
        enabled: !responsesImageGenerationEnabled
      }
    })
  }, [model, providerId, responsesImageGenerationEnabled])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex h-8 items-center justify-center rounded-r-lg border-l border-border/30 transition-colors hover:bg-muted/50',
            supportsThinking && thinkingEnabled
              ? 'gap-0.5 px-1.5 text-violet-600 dark:text-violet-400'
              : 'w-7 text-muted-foreground/50 hover:text-foreground'
          )}
          aria-label={supportsThinking ? t('topbar.deepThinking') : t('topbar.modelSettings')}
          title={
            supportsThinking
              ? t('topbar.deepThinking') + ': ' + (thinkingEnabled
                  ? String(effectiveReasoningEffort).toUpperCase()
                  : tChat('input.thinkingOff'))
              : t('topbar.modelSettings')
          }
        >
          {supportsThinking ? (
            <>
              <Brain className="size-3.5" />
              {thinkingEnabled && (
                <span className="text-[10px] font-semibold leading-none">
                  {String(effectiveReasoningEffort).toLowerCase()}
                </span>
              )}
            </>
          ) : (
            <Settings2 className="size-3" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[388px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border-border/70 bg-popover/95 p-0 shadow-2xl backdrop-blur"
        align="start"
        side={side}
        sideOffset={8}
        collisionPadding={12}
      >
        <div
          className="space-y-4 overflow-y-auto p-4"
          style={{ maxHeight: 'min(32rem, var(--radix-popover-content-available-height))' }}
        >
          {!model && (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              {tChat('input.noModelSettings')}
            </div>
          )}

          {model && (
            <>
              <SettingSection accent="bg-emerald-500" title={tSettings('provider.modelConfig')}>
                {!hasConfigControls && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    {tChat('input.noModelSettings')}
                  </div>
                )}

                {supportsThinking && (!levels || levels.length === 0) && (
                  <PillToggle
                    enabled={thinkingEnabled}
                    onClick={toggleThinking}
                    label={t('topbar.deepThinking')}
                    description={
                      thinkingEnabled
                        ? tChat('input.thinkingLevel', {
                            level: String(effectiveReasoningEffort).toUpperCase()
                          })
                        : tChat('input.thinkingOff')
                    }
                  />
                )}

                {supportsThinking && levels && levels.length > 0 && (
                  <div className="mx-2 space-y-1.5 py-1">
                    <div
                      className={cn(
                        'rounded-lg px-2.5 pb-1 pt-1.5 transition-colors',
                        thinkingEnabled
                          ? 'bg-zinc-950/[0.035] dark:bg-white/[0.035]'
                          : 'bg-muted/20 dark:bg-white/[0.02]'
                      )}
                    >
                      <ReasoningEffortSlider
                        levels={levels}
                        value={effectiveReasoningEffort}
                        onChange={setEffort}
                        dimmed={!thinkingEnabled}
                        fasterLabel={t('topbar.faster')}
                        smarterLabel={t('topbar.smarter')}
                        ariaLabel={t('topbar.reasoningEffort')}
                      />
                    </div>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                        'hover:bg-muted/45 dark:hover:bg-white/[0.04]',
                        thinkingEnabled ? 'text-foreground' : 'text-muted-foreground'
                      )}
                      onClick={toggleThinking}
                    >
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-full',
                          thinkingEnabled
                            ? 'bg-violet-500/12 text-violet-600 dark:text-violet-300'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <Brain className="size-3" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {t('topbar.deepThinking')}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {thinkingEnabled
                            ? tChat('input.thinkingLevel', {
                                level: String(effectiveReasoningEffort).toUpperCase()
                              })
                            : tChat('input.thinkingOff')}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                          thinkingEnabled
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-muted-foreground/30'
                        )}
                      >
                        {thinkingEnabled && <Check className="size-3" />}
                      </span>
                    </button>
                  </div>
                )}

                {supportsAnthropicThinkingBudget && (
                  <div className="px-2 py-1.5">
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          {tSettings('provider.thinkingBudget')}
                        </div>
                        <div className="text-[10px] text-muted-foreground">budget_tokens</div>
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        {thinkingBudget.toLocaleString()}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={MIN_ANTHROPIC_THINKING_BUDGET}
                      max={thinkingBudgetMax}
                      step={1}
                      value={thinkingBudget}
                      onChange={(e) => updateAnthropicThinkingBudget(Number(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>{MIN_ANTHROPIC_THINKING_BUDGET.toLocaleString()}</span>
                      <span>{thinkingBudgetMax.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {supportsAnthropicCacheTtl && (
                  <div className="px-2 py-1.5">
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          {tSettings('provider.cacheTtl')}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {tSettings('provider.cacheTtlHint')}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {(['5m', '1h'] as const).map((ttl) => {
                        const active = anthropicCacheTtl === ttl
                        return (
                          <button
                            key={ttl}
                            type="button"
                            className={cn(
                              'rounded-md border px-2 py-1.5 text-xs font-medium transition-colors',
                              active
                                ? 'border-sky-400 bg-sky-500/10 text-sky-600 dark:text-sky-300'
                                : 'border-border text-muted-foreground hover:bg-muted/50'
                            )}
                            onClick={() => updateAnthropicCacheTtl(ttl)}
                          >
                            {ttl}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {supportsBuiltinSearch && (
                  <PillToggle
                    enabled={builtinSearchEnabled}
                    onClick={toggleBuiltinSearch}
                    label={t('topbar.builtinSearch')}
                    description={
                      builtinSearchEnabled
                        ? t('topbar.builtinSearchOn')
                        : t('topbar.builtinSearchOff')
                    }
                    activeClassName="bg-teal-500 border-teal-500"
                  />
                )}

                {(supportsFastMode ||
                  supportsResponsesWebsocket ||
                  supportsResponsesImageGeneration) && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {supportsFastMode && (
                      <PillToggle
                        compact
                        enabled={fastModeEnabled}
                        onClick={() =>
                          useSettingsStore
                            .getState()
                            .updateSettings({ fastModeEnabled: !fastModeEnabled })
                        }
                        label={t('topbar.fastMode')}
                        activeClassName="bg-amber-500 border-amber-500"
                      />
                    )}

                    {supportsResponsesWebsocket && (
                      <PillToggle
                        compact
                        enabled={websocketEnabled}
                        onClick={toggleResponsesWebsocket}
                        label={tSettings('provider.responsesWebsocket')}
                        activeClassName="bg-sky-500 border-sky-500"
                      />
                    )}

                    {supportsResponsesImageGeneration && (
                      <PillToggle
                        compact
                        enabled={responsesImageGenerationEnabled}
                        onClick={toggleResponsesImageGeneration}
                        label={tSettings('provider.responsesImageGeneration')}
                        activeClassName="bg-emerald-500 border-emerald-500"
                      />
                    )}
                  </div>
                )}
              </SettingSection>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
