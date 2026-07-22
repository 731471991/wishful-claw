import type { AIModelConfig, AIProvider } from '@renderer/lib/api/types'
import type { Session, SessionModelSelectionMode } from '@renderer/stores/chat-store'
import type { MainModelSelectionMode } from '@renderer/stores/settings-store'

export type ResolvedSessionModelSource = 'plugin' | 'session' | 'global'

export interface ResolvedSessionModelSelection {
  mode: SessionModelSelectionMode
  effectiveMode: 'auto' | 'manual'
  source: ResolvedSessionModelSource
  providerId: string | null
  modelId: string | null
  provider: AIProvider | null
  model: AIModelConfig | null
  isAutoModeActive: boolean
  isSessionBound: boolean
}

export function normalizeSessionModelSelectionMode(
  value?: string | null,
  providerId?: string | null,
  modelId?: string | null
): SessionModelSelectionMode {
  if (providerId && modelId && value !== 'auto') return 'manual'
  if (value === 'inherit' || value === 'auto' || value === 'manual') return value
  return 'inherit'
}

export function resolveProviderDefaultModelId(
  providers: AIProvider[],
  providerId: string | null | undefined
): string | null {
  if (!providerId) return null
  const provider = providers.find((item) => item.id === providerId)
  if (!provider) return null
  if (provider.defaultModel) {
    const model = provider.models.find((item) => item.id === provider.defaultModel)
    if (model) return model.id
  }
  const enabledChatModels = provider.models.filter(
    (model) => model.enabled && (!model.category || model.category === 'chat')
  )
  if (enabledChatModels.length > 0) return enabledChatModels[0].id
  const enabledModels = provider.models.filter((model) => model.enabled)
  return enabledModels[0]?.id ?? provider.models[0]?.id ?? null
}

function resolveProviderAndModel(
  providers: AIProvider[],
  providerId: string | null,
  modelId: string | null
): Pick<ResolvedSessionModelSelection, 'provider' | 'model'> {
  const provider = providerId ? (providers.find((item) => item.id === providerId) ?? null) : null
  const model =
    provider && modelId ? (provider.models.find((item) => item.id === modelId) ?? null) : null
  return { provider, model }
}

export function resolveSessionModelSelection({
  session,
  providers,
  activeProviderId,
  activeModelId,
  globalMode,
  channelProviderId,
  channelModelId
}: {
  session?: Pick<Session, 'pluginId' | 'providerId' | 'modelId' | 'modelSelectionMode'> | null
  providers: AIProvider[]
  activeProviderId: string | null
  activeModelId: string
  globalMode: MainModelSelectionMode
  channelProviderId?: string | null
  channelModelId?: string | null
}): ResolvedSessionModelSelection {
  const mode = normalizeSessionModelSelectionMode(
    session?.modelSelectionMode,
    session?.providerId,
    session?.modelId
  )

  const pluginProviderId = channelProviderId ?? session?.providerId ?? null
  const pluginModelId =
    channelModelId ?? session?.modelId ?? resolveProviderDefaultModelId(providers, pluginProviderId)
  if (session?.pluginId && pluginProviderId && pluginModelId) {
    const { provider, model } = resolveProviderAndModel(providers, pluginProviderId, pluginModelId)
    return {
      mode: 'manual',
      effectiveMode: 'manual',
      source: 'plugin',
      providerId: pluginProviderId,
      modelId: pluginModelId,
      provider,
      model,
      isAutoModeActive: false,
      isSessionBound: true
    }
  }

  if (!session?.pluginId && mode === 'manual' && session?.providerId && session.modelId) {
    const { provider, model } = resolveProviderAndModel(
      providers,
      session.providerId,
      session.modelId
    )
    return {
      mode,
      effectiveMode: 'manual',
      source: 'session',
      providerId: session.providerId,
      modelId: session.modelId,
      provider,
      model,
      isAutoModeActive: false,
      isSessionBound: true
    }
  }

  if (!session?.pluginId && mode === 'auto') {
    const { provider, model } = resolveProviderAndModel(providers, activeProviderId, activeModelId)
    return {
      mode,
      effectiveMode: 'auto',
      source: 'session',
      providerId: activeProviderId,
      modelId: activeModelId || null,
      provider,
      model,
      isAutoModeActive: true,
      isSessionBound: false
    }
  }

  const inheritedAuto = globalMode === 'auto'
  const { provider, model } = resolveProviderAndModel(providers, activeProviderId, activeModelId)
  return {
    mode: 'inherit',
    effectiveMode: inheritedAuto ? 'auto' : 'manual',
    source: 'global',
    providerId: activeProviderId,
    modelId: activeModelId || null,
    provider,
    model,
    isAutoModeActive: inheritedAuto,
    isSessionBound: false
  }
}
