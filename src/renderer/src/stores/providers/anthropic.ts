import type { BuiltinProviderPreset } from './types'

export const anthropicPreset: BuiltinProviderPreset = {
  builtinId: 'anthropic',
  version: 1,
  name: 'Anthropic',
  type: 'anthropic',
  defaultBaseUrl: 'https://api.anthropic.com',
  homepage: 'https://anthropic.com',
  apiKeyUrl: 'https://console.anthropic.com/settings/keys',
  defaultModel: 'claude-3-5-haiku-20241022',
  defaultModels: [
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      enabled: true,
      contextLength: 200_000,
      maxOutputTokens: 16_384,
      supportsVision: true,
      supportsFunctionCall: true,
      supportsThinking: true
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku',
      enabled: true,
      contextLength: 200_000,
      maxOutputTokens: 8_192,
      supportsVision: true,
      supportsFunctionCall: true,
      inputPrice: 0.8,
      outputPrice: 4
    }
  ]
}
