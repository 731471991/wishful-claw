export type { BuiltinProviderPreset } from './types'

import { openaiPreset } from './openai'
import { anthropicPreset } from './anthropic'
import { deepseekPreset } from './deepseek'
import { openrouterPreset } from './openrouter'
import { ollamaPreset } from './ollama'
import type { BuiltinProviderPreset } from './types'

export const builtinProviderPresets: BuiltinProviderPreset[] = [
  openaiPreset,
  anthropicPreset,
  deepseekPreset,
  openrouterPreset,
  ollamaPreset
]
