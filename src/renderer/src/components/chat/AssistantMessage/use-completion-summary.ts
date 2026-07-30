// Extracted hook: builds CompletionSummaryData from usage, tokens, and model info

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProviderStore } from '@renderer/stores/provider-store'
import {
  getBillableInputTokens, getCacheCreationTokens, getUsageCacheHitRate, formatCacheHitRate
} from '@renderer/lib/format-tokens'
import { getRequestTraceInfo } from '@renderer/lib/debug-store'
import type { TokenUsage, RequestDebugInfo, MessageMeta } from '@renderer/lib/api/types'
import type { CompletionSummaryData } from './types'
import {
  formatTokenMetric, formatPreciseDurationMs, formatThroughput, toFiniteNumber
} from './utils'

interface UseCompletionSummaryParams {
  usage?: TokenUsage
  fallbackTokens: number
  meta?: MessageMeta
  renderMode: string
  requestDebugInfo?: RequestDebugInfo
  msgId?: string
  sessionModelBinding: { providerId: string | null; modelId: string | null }
  thinkingModel: {
    modelId: string | null
    modelName: string
    modelIcon?: string
    providerName: string | null
    providerBuiltinId?: string
  }
}

export function useCompletionSummary({
  usage,
  fallbackTokens,
  meta,
  renderMode,
  requestDebugInfo,
  msgId,
  sessionModelBinding,
  thinkingModel
}: UseCompletionSummaryParams): CompletionSummaryData | null {
  const { t } = useTranslation('chat')

  return useMemo<CompletionSummaryData | null>(() => {
    if (!usage) {
      if (fallbackTokens <= 0) return null
      return {
        totalTokens: fallbackTokens,
        totalValue: formatTokenMetric(fallbackTokens),
        estimated: true,
        modelName: thinkingModel.modelName,
        modelId: thinkingModel.modelId,
        modelIcon: thinkingModel.modelIcon,
        providerName: thinkingModel.providerName,
        providerBuiltinId: thinkingModel.providerBuiltinId,
        segments: [],
        tokenRows: [],
        metricRows: []
      }
    }

    const providerStore = useProviderStore.getState()
    const providers = providerStore.providers
    const requestModel = meta?.requestModel
    const requestTrace = msgId ? getRequestTraceInfo(msgId) : undefined
    const tracedProviderId = requestDebugInfo?.providerId ?? requestTrace?.providerId ?? null
    const tracedModelId = requestDebugInfo?.model ?? requestTrace?.model ?? null
    const fastProviderConfig =
      renderMode === 'transcript' && !requestModel?.providerId && !tracedProviderId
        ? providerStore.getFastProviderConfig()
        : null
    const fallbackProviderId =
      requestModel?.providerId ??
      tracedProviderId ??
      fastProviderConfig?.providerId ??
      sessionModelBinding.providerId ??
      null
    const provider = fallbackProviderId
      ? providers.find((item: any) => item.id === fallbackProviderId)
      : null
    const modelId =
      requestModel?.modelId ??
      tracedModelId ??
      fastProviderConfig?.model ??
      sessionModelBinding.modelId ??
      thinkingModel.modelId
    const modelCfg = provider?.models.find((item: any) => item.id === modelId) ?? null
    const billableInput = getBillableInputTokens(usage, modelCfg?.type)
    const cacheRead = Math.max(0, usage.cacheReadTokens ?? 0)
    const cacheCreation = getCacheCreationTokens(usage)
    const output = Math.max(0, usage.outputTokens ?? 0)
    const composedInput = billableInput + cacheRead + cacheCreation
    const rawInput = Math.max(0, usage.inputTokens ?? 0, composedInput)
    const totalTokens = rawInput + output
    const cacheHitRate = getUsageCacheHitRate(usage, modelCfg?.type)
    const uncachedColor = '#737373'
    const cacheReadColor = '#f59e0b'
    const cacheCreationColor = '#a78bfa'
    const outputColor = '#a3e635'

    const tokenRows: CompletionSummaryData['tokenRows'] = []
    const metricRows: CompletionSummaryData['metricRows'] = []
    const segments: CompletionSummaryData['segments'] = []

    if (billableInput > 0 || rawInput > 0) {
      tokenRows.push({
        key: 'uncached-input',
        label: t('assistantMessage.uncachedInput', { defaultValue: 'Uncached input' }),
        value: formatTokenMetric(billableInput),
        color: uncachedColor
      })
      segments.push({
        key: 'uncached-input',
        label: t('assistantMessage.uncachedInput', { defaultValue: 'Uncached input' }),
        value: billableInput,
        color: uncachedColor
      })
    }

    if (cacheRead > 0) {
      tokenRows.push({
        key: 'cache-read',
        label: t('assistantMessage.cachedInput', { defaultValue: 'Input cache' }),
        value: formatTokenMetric(cacheRead),
        color: cacheReadColor
      })
      segments.push({
        key: 'cache-read',
        label: t('assistantMessage.cachedInput', { defaultValue: 'Input cache' }),
        value: cacheRead,
        color: cacheReadColor
      })
    }

    if (cacheCreation > 0) {
      tokenRows.push({
        key: 'cache-write',
        label: t('assistantMessage.cacheWrite', { defaultValue: 'Cache write' }),
        value: formatTokenMetric(cacheCreation),
        color: cacheCreationColor
      })
      segments.push({
        key: 'cache-write',
        label: t('assistantMessage.cacheWrite', { defaultValue: 'Cache write' }),
        value: cacheCreation,
        color: cacheCreationColor
      })
    }

    if (output > 0) {
      tokenRows.push({
        key: 'output',
        label: t('analytics.outputTokens', { ns: 'settings', defaultValue: 'Output Tokens' }),
        value: formatTokenMetric(output),
        color: outputColor
      })
      segments.push({
        key: 'output',
        label: t('analytics.outputTokens', { ns: 'settings', defaultValue: 'Output Tokens' }),
        value: output,
        color: outputColor
      })
    }

    if (usage.reasoningTokens) {
      tokenRows.push({
        key: 'reasoning',
        label: t('unit.reasoning', { ns: 'common', defaultValue: 'Reasoning' }),
        value: formatTokenMetric(usage.reasoningTokens),
        color: '#38bdf8'
      })
    }

    if (billableInput + cacheRead > 0) {
      metricRows.push({
        key: 'cache-hit-rate',
        label: t('analytics.cacheTokenShare', {
          ns: 'settings',
          defaultValue: 'Cached Token Share'
        }),
        value: formatCacheHitRate(cacheHitRate)
      })
    }

    if (totalTokens > 0) {
      metricRows.push({
        key: 'total-usage',
        label: t('assistantMessage.totalUsage', { defaultValue: 'Total usage' }),
        value: formatTokenMetric(totalTokens)
      })
    }

    const perRequest = usage.requestTimings ?? []
    const lastTiming = perRequest.length > 0 ? perRequest[perRequest.length - 1] : null
    if (lastTiming) {
      const tps = toFiniteNumber(lastTiming.tps)
      const ttftMs = toFiniteNumber(lastTiming.ttftMs)

      if (tps !== null) {
        metricRows.push({
          key: 'tps',
          label: t('assistantMessage.tps'),
          value: formatThroughput(tps),
          hint: t('assistantMessage.tpsHint', {
            defaultValue: 'Output tokens generated per second'
          })
        })
      }
      if (ttftMs !== null) {
        metricRows.push({
          key: 'ttft',
          label: t('assistantMessage.ttft'),
          value: formatPreciseDurationMs(ttftMs),
          hint: t('assistantMessage.ttftHint', {
            defaultValue: 'Time to first token'
          })
        })
      }
    }

    return {
      totalTokens,
      totalValue: formatTokenMetric(totalTokens),
      estimated: false,
      modelName: requestModel?.modelName ?? modelCfg?.name ?? thinkingModel.modelName,
      modelId,
      modelIcon: requestModel?.modelIcon ?? modelCfg?.icon ?? thinkingModel.modelIcon,
      providerName: requestModel?.providerName ?? provider?.name ?? thinkingModel.providerName,
      providerBuiltinId:
        requestModel?.providerBuiltinId ?? provider?.builtinId ?? thinkingModel.providerBuiltinId,
      segments,
      tokenRows,
      metricRows
    }
  }, [
    fallbackTokens,
    meta?.requestModel,
    renderMode,
    requestDebugInfo?.model,
    requestDebugInfo?.providerId,
    msgId,
    sessionModelBinding.modelId,
    sessionModelBinding.providerId,
    thinkingModel.modelIcon,
    thinkingModel.modelId,
    thinkingModel.modelName,
    thinkingModel.providerBuiltinId,
    thinkingModel.providerName,
    t,
    usage
  ])
}
