export type { BuiltinProviderPreset } from '@renderer/stores/providers/types'

import { openaiPreset } from '@renderer/stores/providers/openai'
import { anthropicPreset } from '@renderer/stores/providers/anthropic'
import { deepseekPreset } from '@renderer/stores/providers/deepseek'
import { openrouterPreset } from '@renderer/stores/providers/openrouter'
import { ollamaPreset } from '@renderer/stores/providers/ollama'
import type { BuiltinProviderPreset } from '@renderer/stores/providers/types'

export const builtinProviderPresets: BuiltinProviderPreset[] = [
  openaiPreset,
  anthropicPreset,
  deepseekPreset,
  openrouterPreset,
  ollamaPreset
]
