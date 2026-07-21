export const SUPPORTED_LANGUAGE_CODES = ['en', 'zh'] as const

export type AppLanguage = (typeof SUPPORTED_LANGUAGE_CODES)[number]

const LANGUAGE_NATIVE_LABELS: Record<AppLanguage, string> = {
  en: 'English',
  zh: '简体中文'
}

const LANGUAGE_ENGLISH_NAMES: Record<AppLanguage, string> = {
  en: 'English',
  zh: 'Chinese'
}

export interface LanguageOption {
  value: AppLanguage
  label: string
}

export const LANGUAGE_OPTIONS: LanguageOption[] = SUPPORTED_LANGUAGE_CODES.map((value) => ({
  value,
  label: LANGUAGE_NATIVE_LABELS[value]
}))

function normalizeLanguageTag(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, '-')
}

export function normalizeLanguageCode(value?: string | null): AppLanguage {
  const normalized = normalizeLanguageTag(value ?? '')
  if (!normalized) return 'en'

  for (const code of SUPPORTED_LANGUAGE_CODES) {
    if (normalized === code || normalized.startsWith(`${code}-`)) {
      return code
    }
  }

  if (normalized.startsWith('zh')) return 'zh'

  return 'en'
}

export function detectSystemLanguage(): AppLanguage {
  if (typeof navigator === 'undefined') return 'en'
  return normalizeLanguageCode(navigator.language || navigator.languages?.[0] || 'en')
}

export function resolveIntlLocale(language?: string | null): string {
  const code = normalizeLanguageCode(language)
  if (code === 'zh') return 'zh-CN'
  return 'en-US'
}

export function resolveLanguageName(language?: string | null): string {
  return LANGUAGE_ENGLISH_NAMES[normalizeLanguageCode(language)]
}
