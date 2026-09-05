import { useRouter } from 'next/router'
import { useState } from 'react'
import { Globe, Check } from 'lucide-react'
import { LOCALES, useLocale } from '@/i18n'

// Compact language dropdown (UZ default + EN/RU/KO). Switches via Next locale routing and
// remembers the choice in the NEXT_LOCALE cookie for return visits.
export default function LangSwitcher({ className = '' }: { className?: string }) {
  const router = useRouter()
  const locale = useLocale()
  const [open, setOpen] = useState(false)

  function pick(code: string) {
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=${60 * 60 * 24 * 365}`
    router.push(router.asPath, router.asPath, { locale: code, scroll: false })
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <button onClick={() => setOpen(o => !o)} aria-label="Til / Language"
        className="flex items-center gap-1.5 bg-white text-ink text-sm font-semibold px-3 py-2 rounded-full shadow-card active:scale-95 transition">
        <Globe className="w-4 h-4 text-rose" />
        <span className="uppercase">{locale}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-40 bg-surface rounded-2xl shadow-card border border-black/5 p-1.5">
            {LOCALES.map(l => (
              <button key={l.code} onClick={() => pick(l.code)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm text-ink hover:bg-cream transition">
                {l.label}
                {locale === l.code && <Check className="w-4 h-4 text-rose" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
