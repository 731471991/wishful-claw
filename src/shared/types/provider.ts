/**
 * Provider core type definitions.
 * Shared between renderer, preload, and main process.
 * Trimmed from OpenCowork — API Key mode only, no OAuth/channel/image-generation.
 */

export type ProviderType =
  | 'anthropic'
  | 'openai-chat'
  | 'openai-responses'
  | 'gemini'

export type ModelCategory = 'chat' | 'embedding' | 'image' | 'video'

export type ReasoningEffortLevel =
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'
  | 'ultra'

export interface ThinkingConfig {
  bodyParams?: Record<string, unknown>
  disabledBodyParams?: Record<string, unknown>
  forceTemperature?: number
  reasoningEffortLevels?: ReasoningEffortLevel[]
  defaultReasoningEffort?: ReasoningEffortLevel
}

export interface AIModelConfig {
  id: string
  name: string
  enabled: boolean
  type?: ProviderType
  category?: ModelCategory
  contextLength?: number
  maxOutputTokens?: number
  supportsVision?: boolean
  supportsFunctionCall?: boolean
  supportsThinking?: boolean
  thinkingConfig?: ThinkingConfig
  icon?: string
  inputPrice?: number
  outputPrice?: number
}

export interface RequestOverrides {
  headers?: Record<string, string>
  body?: Record<string, unknown>
  omitBodyKeys?: string[]
}

export interface AIProvider {
  id: string
  name: string
  type: ProviderType
  apiKey: string
  baseUrl: string
  enabled: boolean
  models: AIModelConfig[]
  builtinId?: string
  presetVersion?: number
  createdAt: number
  requiresApiKey?: boolean
  defaultModel?: string
  useSystemProxy?: boolean
  allowInsecureTls?: boolean
  requestOverrides?: RequestOverrides
}

export interface BuiltinProviderPreset {
  builtinId: string
  version: number
  name: string
  type: ProviderType
  defaultBaseUrl: string
  defaultModels: AIModelConfig[]
  defaultEnabled?: boolean
  requiresApiKey?: boolean
  homepage: string
  apiKeyUrl?: string
  defaultModel?: string
  requestOverrides?: RequestOverrides
}

export interface ProviderTestResult {
  ok: boolean
  statusCode?: number
  error?: string
}

export interface ProviderFetchModelsResult {
  ok: boolean
  models?: AIModelConfig[]
  error?: string
}
