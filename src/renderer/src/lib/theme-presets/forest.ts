import type { ThemePresetDefinition } from './types'
import { createTerminalTheme } from './terminal-theme'

export const forestPreset: ThemePresetDefinition = {
  id: 'forest',
  labelKey: 'general.themePreset.presets.forest.label',
  descriptionKey: 'general.themePreset.presets.forest.desc',
  swatches: ['#2f8b57', '#6fd39a', '#98e0a0'],
  preview: {
    light: {
      rail: '#244937',
      canvas: '#f4f8f4',
      card: '#ffffff',
      accent: '#2f8b57',
      accentSoft: '#e1f1e6',
      text: '#16221b'
}
