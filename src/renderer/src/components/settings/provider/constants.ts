import type { ProviderType, ReasoningEffortLevel } from '../../../../../shared/types/provider'

export const REASONING_EFFORT_OPTIONS: ReasoningEffortLevel[] = [
  'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'
]

export const MODEL_ICON_OPTIONS = [
  'openai', 'claude', 'anthropic', 'gemini', 'deepseek', 'qwen',
  'chatglm', 'minimax', 'kimi', 'moonshot', 'grok', 'meta',
  'llama', 'mistral', 'baidu', 'hunyuan', 'nvidia', 'stepfun',
  'doubao', 'ollama', 'siliconcloud', 'mimo', 'bigmodel'
] as const

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  'anthropic': 'Anthropic Messages',
  'openai-chat': 'OpenAI Chat (兼容)',
  'openai-responses': 'OpenAI Responses',
  'openai-images': 'OpenAI Images',
  'seedance-video': 'Seedance Video (Volcengine)',
  'xai-video': 'xAI Video',
  'gemini': 'Gemini',
  'vertex-ai': 'Vertex AI'
}

export const PROVIDER_TYPE_OPTIONS: ProviderType[] = [
  'openai-chat', 'openai-responses', 'anthropic', 'gemini',
  'openai-images', 'seedance-video', 'xai-video'
]

export const MIN_COMPRESSION_THRESHOLD = 0.3
export const MAX_COMPRESSION_THRESHOLD = 0.9
export const DEFAULT_COMPRESSION_THRESHOLD = 0.8

export function clampCompressionThreshold(value: number): number {
  return Math.min(MAX_COMPRESSION_THRESHOLD, Math.max(MIN_COMPRESSION_THRESHOLD, value))
}

export function toRoundedTokenThousands(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${Math.round(value / 1000)}K`
  return String(value)
}
