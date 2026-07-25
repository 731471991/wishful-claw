import type { ThemePresetDefinition } from './types'
import { createTerminalTheme } from './terminal-theme'

export const graphitePreset: ThemePresetDefinition = {
  id: 'graphite',
  labelKey: 'general.themePreset.presets.graphite.label',
  descriptionKey: 'general.themePreset.presets.graphite.desc',
  swatches: ['#2a7b73', '#7fd4c9', '#7b8798'],
  preview: {
    light: {
      rail: '#3f4349',
      canvas: '#f3f4f5',
      card: '#ffffff',
      accent: '#2a7b73',
      accentSoft: '#dcecea',
      text: '#17191d'
}
