// Pure utility functions and types extracted from ModelSwitcher.tsx

import type { AIModelConfig } from '@renderer/lib/api/types'
import { useProviderStore } from '@renderer/stores/provider-store'
import { useChatStore } from '@renderer/stores/chat-store'
import type { ThinkingConfig, AIProvider } from '@shared/types/provider'
import type { SessionModelSelectionMode } from '@renderer/stores/chat-store'
import { useChannelStore } from '@renderer/stores/channel-store'
import { useSettingsStore } from '@renderer/stores/settings-store'

export function formatContextLength(length?: number): string | null {
  if (!length) return null
  if (length >= 1_000_000)
    return `${(length / 1_000_000).toFixed(length % 1_000_000 === 0 ? 0 : 1)}M`
  if (length >= 1_000) return `${Math.round(length / 1_000)}K`
  return String(length)
}

export const MIN_ANTHROPIC_THINKING_BUDGET = 1024
export const DEFAULT_ANTHROPIC_THINKING_BUDGET = 10000

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function formatTokenCount(value?: number): string {
  const formatted = formatContextLength(value)
  return formatted ? `${formatted} tokens` : '-'
}

export function formatPrice(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `$${value.toFixed(2)}/M tokens`
}

export function readAnthropicThinkingBudget(model?: AIModelConfig): number | null {
  const thinking = model?.thinkingConfig?.bodyParams.thinking
  if (!isRecord(thinking)) return null
  const value = thinking.budget_tokens
  const numeric =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : null
}

export function clampThinkingBudget(value: number, maxOutputTokens?: number): number {
  const upperBound = Math.max(
    MIN_ANTHROPIC_THINKING_BUDGET,
    Math.floor((maxOutputTokens ?? 64_000) - 1)
  )
  return Math.min(upperBound, Math.max(MIN_ANTHROPIC_THINKING_BUDGET, Math.floor(value)))
}

export function buildAnthropicThinkingConfigWithBudget(
  config: ThinkingConfig | undefined,
  budget: number
): ThinkingConfig {
  const nextConfig: ThinkingConfig = {
    ...(config ?? { bodyParams: {} }),
    bodyParams: { ...(config?.bodyParams ?? {}) }
  }
  const rawThinking = nextConfig.bodyParams.thinking
  nextConfig.bodyParams.thinking = {
    ...(isRecord(rawThinking) ? rawThinking : {}),
    type: 'enabled',
    budget_tokens: budget
  }
  delete nextConfig.bodyParams.enable_thinking
  return nextConfig
}

export interface ProviderGroup {
  provider: AIProvider
  models: AIModelConfig[]
}

export interface ModelSwitcherSessionSnapshot {
  id: string
  pluginId?: string
  providerId?: string
  modelId?: string
  modelSelectionMode?: SessionModelSelectionMode
}

export function supportsPriorityServiceTier(model: AIModelConfig | undefined): boolean {
  return !!model?.serviceTier
}

export function selectModel(
  provider: AIProvider,
  modelId: string,
  scopedSessionId: string | null,
  setOpen: (v: boolean) => void
): void {
  const pid = provider.id
  const session = scopedSessionId
    ? useChatStore.getState().sessions.find((item) => item.id === scopedSessionId)
    : null

  if (session) {
    useChatStore.getState().setSessionModelManual(session.id, pid, modelId)
    if (session.pluginId) {
      void useChannelStore
        .getState()
        .updateChannel(session.pluginId, { providerId: pid, model: modelId })
    }
  } else {
    const providerStore = useProviderStore.getState()
    if (pid !== providerStore.activeProviderId) providerStore.setActiveProvider(pid)
    providerStore.setActiveModel(modelId)
    useSettingsStore.getState().updateSettings({ mainModelSelectionMode: 'manual' })
  }
  setOpen(false)
}

export function selectFastModel(
  provider: AIProvider,
  modelId: string,
  activeFastProviderId: string | null,
  setActiveFastProvider: (id: string) => void,
  setActiveFastModel: (id: string) => void,
  setOpen: (v: boolean) => void
): void {
  const pid = provider.id
  if (pid !== activeFastProviderId) setActiveFastProvider(pid)
  setActiveFastModel(modelId)
  setOpen(false)
}

export function selectAutoModel(scopedSessionId: string | null, setOpen: (v: boolean) => void): void {
  const session = scopedSessionId
    ? useChatStore.getState().sessions.find((item) => item.id === scopedSessionId)
    : null
  if (session && !session.pluginId) {
    useChatStore.getState().setSessionModelAuto(session.id)
  } else {
    useSettingsStore.getState().updateSettings({ mainModelSelectionMode: 'auto' })
  }
  setOpen(false)
}

export function selectFollowGlobalModel(
  scopedSessionId: string | null,
  setOpen: (v: boolean) => void
): void {
  const session = scopedSessionId
    ? useChatStore.getState().sessions.find((item) => item.id === scopedSessionId)
    : null
  if (session) {
    useChatStore.getState().setSessionModelInherit(session.id)
    if (session.pluginId) {
      void useChannelStore.getState().updateChannel(session.pluginId, {
        providerId: null,
        model: null
      })
    }
  }
  setOpen(false)
}

/** Settings popover shown next to model icon */

