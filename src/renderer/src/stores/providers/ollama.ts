import type { BuiltinProviderPreset } from '@renderer/stores/providers/types'

export const ollamaPreset: BuiltinProviderPreset = {
  builtinId: 'ollama',
  version: 1,
  name: 'Ollama (Local)',
  type: 'openai-chat',
  defaultBaseUrl: 'http://localhost:11434/v1',
  homepage: 'https://ollama.ai',
  requiresApiKey: false,
  defaultModel: 'llama3.2',
  defaultModels: [
    {
      id: 'llama3.2',
      name: 'Llama 3.2',
      enabled: true,
      contextLength: 128_000
    },
    {
      id: 'qwen2.5-coder',
      name: 'Qwen 2.5 Coder',
      enabled: true,
      contextLength: 128_000,
      supportsFunctionCall: true
    }
  ]
}
