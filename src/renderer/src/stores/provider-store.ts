import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { AIProvider, AIModelConfig, BuiltinProviderPreset, ProviderType, ReasoningEffortLevel } from '../../../shared/types/provider'
import { builtinProviderPresets } from '@renderer/stores/providers'
import { aiProviderStorage } from '@renderer/lib/ipc/ai-provider-storage'

const STORAGE_KEY = 'wishful-claw-providers'

export { builtinProviderPresets }
export type { BuiltinProviderPreset }

interface ProviderState {
  providers: AIProvider[]
  activeProviderId: string | null
  activeModelId: string
  activeFastProviderId: string | null
  activeFastModelId: string
  defaultModel: string | null

  // ── Selectors ──
  getActiveProvider: () => AIProvider | null
  getProviderById: (id: string) => AIProvider | null

  // ── Mutations ──
  addProviderFromPreset: (preset: BuiltinProviderPreset) => AIProvider
  addCustomProvider: (name: string, type: ProviderType, baseUrl: string) => AIProvider
  updateProvider: (id: string, updates: Partial<AIProvider>) => void
  deleteProvider: (id: string) => void
  setActiveProvider: (id: string) => void
  setActiveModel: (modelId: string) => void
  setActiveFastProvider: (id: string) => void
  setActiveFastModel: (modelId: string) => void
  getFastProviderConfig: () => { providerId: string; model: string; apiKey?: string; requiresApiKey?: boolean; baseUrl?: string } | null
  // Speech provider stubs (for pet voice features)
  activeSpeechProviderId: string | null
  activeSpeechModelId: string
  getProviderConfigById: (id: string, _modelId?: string) => AIProvider | null
  getActiveModelConfig: () => { responseSummary?: any; enablePromptCache?: boolean; enableSystemPromptCache?: boolean } | null
  getEffectiveMaxTokens: (userDefault?: number | null, modelId?: string) => number
  getCompressionProviderConfig: () => { providerId: string | undefined; model: string } | null
  getTranslationProviderConfig: () => { providerId: string | null; model: string } | null
  activeImageProviderId: string | null
  activeImageModelId: string
  activeTranslationProviderId: string | null
  activeTranslationModelId: string
  getSpeechProviderConfig: () => { providerId: string | null; model: string } | null
  setDefaultModel: (modelId: string) => void

  // ── Model management ──
  addModel: (providerId: string, model: AIModelConfig) => void
  updateModel: (providerId: string, modelId: string, updates: Partial<AIModelConfig>) => void
  deleteModel: (providerId: string, modelId: string) => void
  setModels: (providerId: string, models: AIModelConfig[]) => void

  // ── Worker API (test + fetch models) ──
  testConnection: (provider: AIProvider, modelId?: string) => Promise<{ ok: boolean; statusCode?: number; error?: string }>
  fetchModels: (provider: AIProvider) => Promise<AIModelConfig[]>
}

function createProviderFromPreset(preset: BuiltinProviderPreset): AIProvider {
  return {
    id: nanoid(),
    name: preset.name,
    type: preset.type,
    apiKey: '',
    baseUrl: preset.defaultBaseUrl,
    enabled: preset.defaultEnabled ?? false,
    models: preset.defaultModels.map(m => ({ ...m })),
    builtinId: preset.builtinId,
    presetVersion: preset.version,
    createdAt: Date.now(),
    requiresApiKey: preset.requiresApiKey ?? true,
    defaultModel: preset.defaultModel
  }
}

/**
 * Normalize a model ID for case-insensitive matching.
 */
function normalizeModelKey(modelId: string): string {
  return modelId.trim().toLowerCase()
}

/** Default reasoning effort levels for thinking models that don't specify their own. */
const DEFAULT_REASONING_EFFORT_LEVELS: ReasoningEffortLevel[] = ['medium', 'high', 'xhigh']
const DEFAULT_REASONING_EFFORT: ReasoningEffortLevel = 'medium'

/**
 * Ensure a thinking model has reasoning effort levels configured.
 * If supportsThinking is true but reasoningEffortLevels is missing/empty,
 * fill in the default levels so the UI shows a usable effort selector
 * without requiring manual configuration.
 */
function ensureDefaultReasoningEffort(model: AIModelConfig): AIModelConfig {
  if (!model.supportsThinking) return model
  if (model.thinkingConfig?.reasoningEffortLevels?.length) return model
  return {
    ...model,
    thinkingConfig: {
      ...(model.thinkingConfig ?? { bodyParams: {} }),
      reasoningEffortLevels: [...DEFAULT_REASONING_EFFORT_LEVELS],
      defaultReasoningEffort: model.thinkingConfig?.defaultReasoningEffort ?? DEFAULT_REASONING_EFFORT
    }
  }
}

/**
 * Global registry of all builtin models across all presets, keyed by normalized model ID.
 * This allows matching models from any provider (including custom/relay providers)
 * against builtin metadata (thinkingConfig, icon, pricing, etc.).
 * Thinking models without explicit reasoning effort levels get sensible defaults.
 */
const builtinModelRegistry = new Map<string, AIModelConfig>()
for (const preset of builtinProviderPresets) {
  for (const model of preset.defaultModels) {
    const key = normalizeModelKey(model.id)
    if (!builtinModelRegistry.has(key)) {
      builtinModelRegistry.set(key, ensureDefaultReasoningEffort({ ...model }))
    }
  }
}

/**
 * Look up a model in the builtin registry by model ID.
 * Returns a partial AIModelConfig with metadata (thinkingConfig, icon, pricing, etc.)
 * or undefined if no match is found.
 */
function resolveBuiltinModelFallback(modelId: string): AIModelConfig | undefined {
  return builtinModelRegistry.get(normalizeModelKey(modelId))
}

/**
 * Merge a raw discovered model with builtin metadata.
 * Builtin metadata (thinkingConfig, icon, supportsThinking, pricing, etc.) is used
 * as the base; discovered values (id, name, enabled) override.
 */
function enrichDiscoveredModel(raw: AIModelConfig): AIModelConfig {
  const fallback = resolveBuiltinModelFallback(raw.id)
  if (!fallback) return ensureDefaultReasoningEffort(raw)
  const merged = { ...fallback, ...raw }
  // If raw overrode thinkingConfig without reasoningEffortLevels, restore from fallback
  if (merged.supportsThinking && !merged.thinkingConfig?.reasoningEffortLevels?.length) {
    return ensureDefaultReasoningEffort(merged)
  }
  return merged
}

function createCustomProvider(name: string, type: ProviderType, baseUrl: string): AIProvider {
  return {
    id: nanoid(),
    name,
    type,
    apiKey: '',
    baseUrl,
    enabled: true,
    models: [],
    createdAt: Date.now(),
    requiresApiKey: true
  }
}

/**
 * Ensure all builtin presets exist in the provider list.
 * Missing presets are added with defaultEnabled state.
 * Existing presets with outdated version are upgraded:
 *   - New models from the preset are added (preserving user-added models)
 *   - Preset model metadata (price, context, thinking config, etc.) is refreshed
 *   - Provider type/baseUrl are updated if the preset changed them
 *   - User customizations (apiKey, enabled, per-model enabled flags) are preserved
 * Called on store initialization (after hydration).
 */
function ensureBuiltinPresets(): void {
  const currentProviders = useProviderStore.getState().providers
  let changed = false
  const nextProviders = [...currentProviders]

  for (const preset of builtinProviderPresets) {
    const existing = currentProviders.findIndex(p => p.builtinId === preset.builtinId)
    if (existing === -1) {
      // Missing preset — add it
      const provider = createProviderFromPreset(preset)
      nextProviders.push(provider)
      changed = true
      continue
    }

    const current = currentProviders[existing]
    if ((current.presetVersion ?? 0) >= preset.version) continue

    // Version upgrade — refresh model list while preserving user state
    const presetModelIds = new Set(preset.defaultModels.map(m => m.id))
    const userCustomModels = current.models.filter(m => !presetModelIds.has(m.id))

    // For preset models, preserve user's enabled flag; refresh all other metadata
    const refreshedModels = preset.defaultModels.map(presetModel => {
      const userModel = current.models.find(m => m.id === presetModel.id)
      if (userModel) {
        return { ...presetModel, enabled: userModel.enabled }
      }
      return { ...presetModel }
    })

    nextProviders[existing] = {
      ...current,
      type: preset.type,
      baseUrl: preset.defaultBaseUrl,
      models: [...refreshedModels, ...userCustomModels],
      presetVersion: preset.version
    }
    changed = true
  }

  const state = useProviderStore.getState()
  const updates: Partial<ProviderState> = {}
  if (changed) {
    updates.providers = nextProviders
  }
  // If no active provider is set, pick the first available one
  if (!state.activeProviderId && nextProviders.length > 0) {
    const firstProvider = nextProviders[0]
    updates.activeProviderId = firstProvider.id
    // Pick default model
    const defaultModel =
      firstProvider.models.find((m) => m.id === firstProvider.defaultModel) ??
      firstProvider.models.find((m) => m.enabled && (!m.category || m.category === 'chat')) ??
      firstProvider.models.find((m) => m.enabled) ??
      firstProvider.models[0]
    if (defaultModel) {
      updates.activeModelId = defaultModel.id
    }
  }
  // If activeProviderId is set but activeModelId is empty, resolve a default model
  if (state.activeProviderId && !state.activeModelId) {
    const provider = nextProviders.find((p) => p.id === state.activeProviderId)
    if (provider) {
      const defaultModel =
        provider.models.find((m) => m.id === provider.defaultModel) ??
        provider.models.find((m) => m.enabled && (!m.category || m.category === 'chat')) ??
        provider.models.find((m) => m.enabled) ??
        provider.models[0]
      if (defaultModel) {
        updates.activeModelId = defaultModel.id
      }
    }
  }
  if (Object.keys(updates).length > 0) {
    useProviderStore.setState(updates)
  }
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      providers: [],
      activeProviderId: null,
      activeModelId: '',
      activeFastProviderId: null,
      activeFastModelId: '',
      defaultModel: null,

      getActiveProvider: () => {
        const { providers, activeProviderId } = get()
        if (!activeProviderId) return providers[0] ?? null
        return providers.find(p => p.id === activeProviderId) ?? null
      },

      getProviderById: (id) => get().providers.find(p => p.id === id) ?? null,

      addProviderFromPreset: (preset) => {
        const provider = createProviderFromPreset(preset)
        set(state => ({
          providers: [...state.providers, provider],
          activeProviderId: state.activeProviderId ?? provider.id
        }))
        return provider
      },

      addCustomProvider: (name, type, baseUrl) => {
        const provider = createCustomProvider(name, type, baseUrl)
        set(state => ({
          providers: [...state.providers, provider],
          activeProviderId: state.activeProviderId ?? provider.id
        }))
        return provider
      },

      updateProvider: (id, updates) => {
        set(state => ({
          providers: state.providers.map(p =>
            p.id === id ? { ...p, ...updates } : p
          )
        }))
      },

      deleteProvider: (id) => {
        set(state => {
          const providers = state.providers.filter(p => p.id !== id)
          const activeProviderId =
            state.activeProviderId === id
              ? (providers[0]?.id ?? null)
              : state.activeProviderId
          return { providers, activeProviderId }
        })
      },

      setActiveProvider: (id) => set({ activeProviderId: id }),

      setActiveModel: (modelId) => set({ activeModelId: modelId }),

      setActiveFastProvider: (id) => set({ activeFastProviderId: id }),

      setActiveFastModel: (modelId) => set({ activeFastModelId: modelId }),

      getFastProviderConfig: () => {
        const { activeFastProviderId, activeFastModelId, providers } = get()
        if (!activeFastProviderId) return null
        const provider = providers.find((p) => p.id === activeFastProviderId)
        if (!provider) return null
        return { providerId: activeFastProviderId, model: activeFastModelId || provider.defaultModel || '' }
      },
      activeSpeechProviderId: null,
      activeSpeechModelId: '',
      getProviderConfigById: (id: string, _modelId?: string) => get().providers.find(p => p.id === id) ?? null,
      getActiveModelConfig: () => {
        const { providers, activeProviderId, activeModelId } = get()
        const provider = providers.find(p => p.id === activeProviderId)
        if (!provider) return null
        const model = provider.models?.find((m: any) => m.id === activeModelId)
        return model ?? null
      },
      getEffectiveMaxTokens: (userDefault?: number | null, _modelId?: string) => {
        return userDefault ?? 4096
      },
      getCompressionProviderConfig: () => {
        const { activeFastProviderId, activeFastModelId } = get()
        if (!activeFastProviderId) return null
        return { providerId: activeFastProviderId, model: activeFastModelId }
      },
      getTranslationProviderConfig: () => {
        const { activeTranslationProviderId, activeTranslationModelId } = get()
        if (!activeTranslationProviderId) return null
        return { providerId: activeTranslationProviderId, model: activeTranslationModelId }
      },
      activeImageProviderId: null,
      activeImageModelId: '',
      activeTranslationProviderId: null,
      activeTranslationModelId: '',
      getSpeechProviderConfig: () => {
        const { activeSpeechProviderId, activeSpeechModelId } = get()
        if (!activeSpeechProviderId) return null
        return { providerId: activeSpeechProviderId, model: activeSpeechModelId }
      },

      setDefaultModel: (modelId) => set({ defaultModel: modelId }),

      addModel: (providerId, model) => {
        set(state => ({
          providers: state.providers.map(p =>
            p.id === providerId
              ? { ...p, models: [...p.models, model] }
              : p
          )
        }))
      },

      updateModel: (providerId, modelId, updates) => {
        set(state => ({
          providers: state.providers.map(p =>
            p.id === providerId
              ? {
                  ...p,
                  models: p.models.map(m =>
                    m.id === modelId ? { ...m, ...updates } : m
                  )
                }
              : p
          )
        }))
      },

      deleteModel: (providerId, modelId) => {
        set(state => ({
          providers: state.providers.map(p =>
            p.id === providerId
              ? { ...p, models: p.models.filter(m => m.id !== modelId) }
              : p
          )
        }))
      },

      setModels: (providerId, models) => {
        set(state => ({
          providers: state.providers.map(p => {
            if (p.id !== providerId) return p
            // Preserve user customizations for existing models (thinkingConfig, enabled, etc.)
            // while enriching newly discovered models with builtin metadata
            const existingById = new Map(p.models.map(m => [m.id, m]))
            const merged = models.map(m => {
              const existing = existingById.get(m.id)
              if (existing) {
                // Merge thinkingConfig: preserve user customizations but fill in missing
                // fields (e.g. reasoningEffortLevels) from the enriched version
                const mergedThinking = existing.thinkingConfig
                  ? { ...m.thinkingConfig, ...existing.thinkingConfig }
                  : m.thinkingConfig
                return { ...existing, ...m, thinkingConfig: mergedThinking }
              }
              // New model — enrich with builtin metadata
              return enrichDiscoveredModel(m)
            })
            return { ...p, models: merged }
          })
        }))
      },

      testConnection: async (provider, modelId) => {
        return window.api.workerRequest('provider/test', {
          type: provider.type,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          builtinId: provider.builtinId,
          modelId
        })
      },

      fetchModels: async (provider) => {
        const result = await window.api.workerRequest<{ ok: boolean; models?: AIModelConfig[]; error?: string }>(
          'provider/fetch-models',
          {
            type: provider.type,
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            builtinId: provider.builtinId
          }
        )
        if (!result.ok) {
          throw new Error(result.error ?? 'Failed to fetch models')
        }
        // Enrich discovered models with builtin metadata (thinkingConfig, icon, pricing, etc.)
        return (result.models ?? []).map(enrichDiscoveredModel)
      }
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => aiProviderStorage),
      partialize: (state) => ({
        providers: state.providers,
        activeProviderId: state.activeProviderId,
        activeModelId: state.activeModelId,
        activeFastProviderId: state.activeFastProviderId,
        activeFastModelId: state.activeFastModelId,
        defaultModel: state.defaultModel
      }),
      onRehydrateStorage: () => (state) => {
        // After hydration, ensure all builtin presets exist
        if (state) {
          ensureBuiltinPresets()
        }
      }
    }
  )
)


// ── Helper functions (from OpenCowork, simplified) ──

export function modelSupportsVision(
  model: AIModelConfig | null | undefined,
  providerType?: ProviderType
): boolean {
  if (!model) return providerType === 'openai-images'
  const requestType = model.type ?? providerType
  return Boolean(
    model.supportsVision || model.category === 'image' || requestType === 'openai-images'
  )
}

export function isProviderAuthReady(provider: AIProvider | null | undefined): boolean {
  if (!provider) return false
  const authMode = provider.authMode ?? 'apiKey'
  if (authMode === 'apiKey') {
    return provider.requiresApiKey === false || provider.apiKey.trim().length > 0
  }
  return false
}

export function isProviderAvailableForModelSelection(
  provider: AIProvider | null | undefined
): boolean {
  if (!provider?.enabled) return false
  return isProviderAuthReady(provider)
}

export function modelSupportsBuiltinSearch(
  model: AIModelConfig | null | undefined,
  providerType?: ProviderType
): boolean {
  if (!model) return false
  const requestType = model.type ?? providerType
  return (
    (requestType === 'anthropic' || requestType === 'openai-responses') &&
    model.supportsBuiltinSearch === true
  )
}

export function modelSupportsResponsesWebsocket(
  model: AIModelConfig | null | undefined,
  providerType?: ProviderType
): boolean {
  if (!model) return false
  const requestType = model.type ?? providerType
  return requestType === 'openai-responses' && model.supportsWebsocket === true
}

export function modelSupportsResponsesImageGeneration(
  model: AIModelConfig | null | undefined,
  providerType?: ProviderType
): boolean {
  if (!model) return false
  const requestType = model.type ?? providerType
  return requestType === 'openai-responses' && model.supportsImageGeneration === true
}

/**
 * Initialize provider store — call once on app startup.
 * Ensures builtin presets exist even before hydration completes.
 */
export function initProviderStore(): void {
  // If store hasn't hydrated yet, ensure builtins after hydration
  if (!useProviderStore.persist.hasHydrated()) {
    useProviderStore.persist.onFinishHydration(() => {
      ensureBuiltinPresets()
    })
  } else {
    ensureBuiltinPresets()
  }
}
