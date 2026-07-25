import type { ThemePresetDefinition } from './types'
import { createTerminalTheme } from './terminal-theme'

export const dawnPreset: ThemePresetDefinition = {
  id: 'dawn',
  labelKey: 'general.themePreset.presets.dawn.label',
  descriptionKey: 'general.themePreset.presets.dawn.desc',
  swatches: ['#ca6a33', '#ffb27d', '#ffd8a8'],
  preview: {
    light: {
      rail: '#6a402f',
      canvas: '#fbf6f2',
      card: '#ffffff',
      accent: '#ca6a33',
      accentSoft: '#f9e5da',
      text: '#2b1d19'
}
