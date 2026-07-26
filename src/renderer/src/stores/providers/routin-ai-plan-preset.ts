import type { BuiltinProviderPreset } from './types'
import { routinAiPreset } from './routin-ai'

/** Model IDs for Routin 套餐（https://api.routin.ai/plan/v1）：Codex 全系、GPT-5.4 系、Claude 全系 */
const ROUTIN_AI_PLAN_MODEL_ORDER = [
  'gpt-5.3-codex-spark',
  'gpt-5.5',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.6-sol',
  'claude-fable-5',
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-5-20251101'
] as const

// Build model lookup from the main preset (no circular dep — routinAiPreset
// is defined at the top of routin-ai.ts and does not depend on this file)
const routinAiModelById = new Map(routinAiPreset.defaultModels.map((m) => [m.id, m]))

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
