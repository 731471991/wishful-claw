import type { ThemePresetDefinition } from './types'
import { createTerminalTheme } from './terminal-theme'

export const oceanPreset: ThemePresetDefinition = {
  id: 'ocean',
  labelKey: 'general.themePreset.presets.ocean.label',
  descriptionKey: 'general.themePreset.presets.ocean.desc',
  swatches: ['#0f8aa6', '#4cc9f0', '#8be3ff'],
  preview: {
    light: {
      rail: '#0f5162',
      canvas: '#eef7f8',
      card: '#ffffff',
      accent: '#0f8aa6',
      accentSoft: '#d7f0f6',
      text: '#13232a'
}
