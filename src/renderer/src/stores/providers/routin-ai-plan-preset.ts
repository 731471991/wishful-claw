import type { BuiltinProviderPreset } from './types'


// Extracted from routin-ai.ts
export const routinAiPlanPreset: BuiltinProviderPreset = {
  builtinId: 'routin-ai-plan',
  // v2: gpt-5.4+ models support the Responses WebSocket transport (supportsWebsocket)
  version: 2,
  name: 'Routin AI（套餐）',
  type: 'openai-chat',
  defaultBaseUrl: 'https://api.routin.ai/plan/v1',
  homepage: 'https://routin.ai',
  apiKeyUrl: 'https://routin.ai/dashboard/api-keys',
  defaultEnabled: false,
  defaultModel: 'gpt-5.4',
  defaultModels: ROUTIN_AI_PLAN_MODEL_ORDER.map((id) => {
    const config = routinAiModelById.get(id)
    if (!config) {
      throw new Error(`routin-ai plan preset: missing model ${id}`)
    }
    return config
  })
}
