import type { BuiltinProviderPreset } from './types'

export const deepseekPreset: BuiltinProviderPreset = {
  builtinId: 'deepseek',
  version: 1,
  name: 'DeepSeek',
  type: 'openai-chat',
  defaultBaseUrl: 'https://api.deepseek.com/v1',
  homepage: 'https://deepseek.com',
  apiKeyUrl: 'https://platform.deepseek.com/api_keys',
  defaultModel: 'deepseek-chat',
  defaultModels: [
    {
      id: 'deepseek-chat',
      name: 'DeepSeek Chat',
      enabled: true,
      contextLength: 64_000,
      maxOutputTokens: 8_192,
      supportsFunctionCall: true,
      inputPrice: 0.14,
      outputPrice: 0.28
    },
    {
      id: 'deepseek-reasoner',
      name: 'DeepSeek Reasoner',
      enabled: true,
      contextLength: 64_000,
      maxOutputTokens: 8_192,
      supportsThinking: true,
      inputPrice: 0.55,
      outputPrice: 2.19
    }
  ]
}
