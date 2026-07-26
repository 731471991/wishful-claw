// Runtime status bar: token/cost/TPS/TTFT metrics + streaming status indicator

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
export function RuntimeTokenStatistics({
  sessionId,
  messages,
  streamingMessageId,
  usage,
  requestModel,
  isStreaming = false,
  className
}: {
  sessionId: string
  messages: readonly UnifiedMessage[]
  streamingMessageId?: string | null
  usage?: TokenUsage
  requestModel?: MessageRequestModelMeta | null
  isStreaming?: boolean
  className?: string
}): React.JSX.Element {
  const model = useProviderStore(
    useShallow((state) => {
      if (!requestModel?.modelId) return null
      const provider = state.providers.find(
        (item) =>
          (!!requestModel.providerId && item.id === requestModel.providerId) ||
          (!!requestModel.providerBuiltinId && item.builtinId === requestModel.providerBuiltinId)
      )
      return provider?.models.find((item) => item.id === requestModel.modelId) ?? null
    })
  )

  return (
    <ComposerRuntimeStatus
      sessionId={sessionId}
      isStreaming={isStreaming}
      draftInputTokens={0}
      contextCompressionStatus="idle"
      contextCompressionStatusLabel=""
      model={model}
      messagesOverride={messages}
      streamingMessageIdOverride={streamingMessageId}
      usageOverride={usage}
      showStatus={false}
      className={className}
    />
  )
}
