import type { ThemePresetDefinition } from './types'
import { createTerminalTheme } from './terminal-theme'

export const studioPreset: ThemePresetDefinition = {
  id: 'studio',
  labelKey: 'general.themePreset.presets.studio.label',
  descriptionKey: 'general.themePreset.presets.studio.desc',
  swatches: ['#3558e8', '#7aa7ff', '#f08f61'],
  preview: {
    light: {
      rail: '#304064',
      canvas: '#eef2f6',
      card: '#ffffff',
      accent: '#3558e8',
      accentSoft: '#dfe8ff',
      text: '#202b41'
}
