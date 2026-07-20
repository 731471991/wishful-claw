import type { BuiltinProviderPreset } from './types'

export const openaiPreset: BuiltinProviderPreset = {
  builtinId: 'openai',
  version: 1,
  name: 'OpenAI',
  type: 'openai-chat',
  defaultBaseUrl: 'https://api.openai.com/v1',
  homepage: 'https://openai.com',
  apiKeyUrl: 'https://platform.openai.com/api-keys',
  defaultModel: 'gpt-4o-mini',
  defaultModels: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      enabled: true,
      contextLength: 128_000,
      maxOutputTokens: 16_384,
      supportsVision: true,
      supportsFunctionCall: true
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      enabled: true,
      contextLength: 128_000,
      maxOutputTokens: 16_384,
      supportsVision: true,
      supportsFunctionCall: true,
      inputPrice: 0.15,
      outputPrice: 0.6
    }
  ]
}
