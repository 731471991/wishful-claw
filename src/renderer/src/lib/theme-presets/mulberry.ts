import type { ThemePresetDefinition } from './types'
import { createTerminalTheme } from './terminal-theme'

export const mulberryPreset: ThemePresetDefinition = {
  id: 'mulberry',
  labelKey: 'general.themePreset.presets.mulberry.label',
  descriptionKey: 'general.themePreset.presets.mulberry.desc',
  swatches: ['#18181b', '#71717a', '#fafafa'],
  preview: {
    light: {
      rail: '#f1f2f4',
      canvas: '#ffffff',
      card: '#ffffff',
      accent: '#18181b',
      accentSoft: '#e7e8ec',
      text: '#09090b'
}
