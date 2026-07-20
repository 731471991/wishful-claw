import type { BuiltinProviderPreset } from './types'

export const openrouterPreset: BuiltinProviderPreset = {
  builtinId: 'openrouter',
  version: 1,
  name: 'OpenRouter',
  type: 'openai-chat',
  defaultBaseUrl: 'https://openrouter.ai/api/v1',
  homepage: 'https://openrouter.ai',
  apiKeyUrl: 'https://openrouter.ai/keys',
  defaultModel: 'openai/gpt-4o-mini',
  defaultModels: [
    {
      id: 'openai/gpt-4o-mini',
      name: 'OpenAI GPT-4o Mini',
      enabled: true,
      contextLength: 128_000,
      supportsFunctionCall: true
    },
    {
      id: 'anthropic/claude-3.5-haiku',
      name: 'Claude 3.5 Haiku (via OpenRouter)',
      enabled: true,
      contextLength: 200_000,
      supportsFunctionCall: true
    }
  ]
}
