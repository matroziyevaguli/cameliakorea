import { useRouter } from 'next/router'
import { Locale } from '@/lib/i18n'

const languages: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' }, { code: 'ko', label: '한국어' }, { code: 'uz', label: 'UZ' }
]

export default function LanguageSwitcher() {
  const router = useRouter()
  const active = (router.locale || 'en') as Locale
  const changeLanguage = (locale: Locale) => router.push(router.asPath, router.asPath, { locale, scroll: false })

  return (
    <div className="language-switcher" aria-label="Language selector">
      {languages.map(({ code, label }) => (
        <button key={code} className={active === code ? 'active' : ''} onClick={() => changeLanguage(code)} aria-pressed={active === code}>{label}</button>
      ))}
    </div>
  )
}
