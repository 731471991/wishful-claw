import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { AIProvider, AIModelConfig, BuiltinProviderPreset, ProviderType } from '../../../shared/types/provider'
import { builtinProviderPresets } from '@renderer/stores/providers'
import { aiProviderStorage } from '@renderer/lib/ipc/ai-provider-storage'

const STORAGE_KEY = 'wishful-claw-providers'

export { builtinProviderPresets }
export type { BuiltinProviderPreset }

interface ProviderState {
  providers: AIProvider[]
  activeProviderId: string | null
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
  setDefaultModel: (modelId: string) => void

  // ── Model management ──
  addModel: (providerId: string, model: AIModelConfig) => void
  updateModel: (providerId: string, modelId: string, updates: Partial<AIModelConfig>) => void
  deleteModel: (providerId: string, modelId: string) => void
  setModels: (providerId: string, models: AIModelConfig[]) => void

  // ── Worker API (test + fetch models) ──
  testConnection: (provider: AIProvider) => Promise<{ ok: boolean; statusCode?: number; error?: string }>
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
 * Called on store initialization (after hydration).
 */
function ensureBuiltinPresets(): void {
  const currentProviders = useProviderStore.getState().providers

  for (const preset of builtinProviderPresets) {
    const existing = currentProviders.find(p => p.builtinId === preset.builtinId)
    if (!existing) {
      const provider = createProviderFromPreset(preset)
      useProviderStore.setState(state => ({
        providers: [...state.providers, provider]
      }))
    }
  }
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      providers: [],
      activeProviderId: null,
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
          providers: state.providers.map(p =>
            p.id === providerId ? { ...p, models } : p
          )
        }))
      },

      testConnection: async (provider) => {
        return window.api.workerRequest('provider/test', {
          type: provider.type,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          builtinId: provider.builtinId
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
        return result.models ?? []
      }
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => aiProviderStorage),
      partialize: (state) => ({
        providers: state.providers,
        activeProviderId: state.activeProviderId,
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
