import { useRouter } from 'next/router'
import { dict } from './dict'

// Shop i18n. Default Uzbek; en/ru/ko available via the switcher (Next built-in locale routing).
// t('key', { var }) interpolates {var}; missing keys fall back to Uzbek, then the raw key.
export type Locale = 'uz' | 'en' | 'ru' | 'ko'
export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'uz', label: "O'zbekcha" },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'ko', label: '한국어' },
]
const CODES = LOCALES.map(l => l.code)

export function useLocale(): Locale {
  const { locale } = useRouter()
  return (locale && CODES.includes(locale as Locale) ? locale : 'uz') as Locale
}

export type TFunc = (key: string, vars?: Record<string, string | number>) => string

export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const entry = (dict as Record<string, Partial<Record<Locale, string>>>)[key]
  let s = entry ? (entry[locale] ?? entry.uz ?? key) : key
  if (vars) for (const k of Object.keys(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(vars[k]))
  return s
}

export function useT(): TFunc {
  const locale = useLocale()
  return (key, vars) => translate(locale, key, vars)
}
