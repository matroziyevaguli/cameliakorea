import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@/lib/supabase/browser'
import { LayoutDashboard, Package, Users, CreditCard, Inbox, ShoppingBag, MessageCircleQuestion, LogOut, Menu, X } from 'lucide-react'
import LangSwitcher from '@/components/LangSwitcher'
import { useT } from '@/i18n'

// Five areas, grouped by the decision each one serves (redesign.md §5.0) — not nine
// flat links. Batches + Distribute live under Mahsulotlar; Giveaways under Pul; Stats
// folded into Boshqaruv.
const areas = [
  { href: '/admin',            labelKey: 'anav.dashboard',  icon: LayoutDashboard, match: ['/admin'] },
  { href: '/admin/products',   labelKey: 'anav.products',   icon: Package,         match: ['/admin/products', '/admin/batches', '/admin/distribute'] },
  { href: '/admin/orders',     labelKey: 'anav.orders',     icon: ShoppingBag,     match: ['/admin/orders'] },
  { href: '/admin/sellers',    labelKey: 'anav.sellers',    icon: Users,           match: ['/admin/sellers', '/admin/sellers/[id]'] },
  { href: '/admin/payments',   labelKey: 'anav.money',      icon: CreditCard,      match: ['/admin/payments', '/admin/giveaways'] },
  { href: '/admin/requests',   labelKey: 'anav.requests',   icon: Inbox,           match: ['/admin/requests'] },
  { href: '/admin/community',  labelKey: 'nav.qa',          icon: MessageCircleQuestion, match: ['/admin/community'] },
]

// Second row — only for areas that have more than one screen.
const SUB: Record<string, { href: string; labelKey: string }[]> = {
  '/admin/products': [
    { href: '/admin/products',   labelKey: 'anav.list' },
    { href: '/admin/batches',    labelKey: 'anav.batches' },
    { href: '/admin/distribute', labelKey: 'anav.distribute' },
  ],
  '/admin/payments': [
    { href: '/admin/payments',  labelKey: 'anav.payments' },
    { href: '/admin/giveaways', labelKey: 'anav.giveaways' },
  ],
}

export default function AdminNav() {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(0)

  // Live count of pending requests (allocation + price) → red badge on So'rovlar.
  useEffect(() => {
    const supabase = createClient()
    const count = () => Promise.all([
      supabase.from('allocation_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('sale_price_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]).then(([a, b]) => setPending((a.count ?? 0) + (b.count ?? 0))).catch(() => {})
    count()
    window.addEventListener('camelia-requests-changed', count)
    return () => window.removeEventListener('camelia-requests-changed', count)
  }, [router.pathname])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const activeArea = areas.find(a => a.match.includes(router.pathname))
  const subLinks = activeArea ? SUB[activeArea.href] : undefined

  return (
    <header className="bg-surface border-b border-gray-100 shadow-sm sticky top-0 z-30">
      <div className="px-4 md:px-6 flex items-center justify-between">
        <Link href="/admin" className="font-display font-bold text-ink text-lg py-4 flex items-center gap-2">
          <span className="text-rose">✦</span> Camelia <span className="hidden sm:inline">Admin</span>
        </Link>

        {/* Desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {areas.map(a => {
            const active = activeArea?.href === a.href
            const Icon = a.icon
            return (
              <Link key={a.href} href={a.href}
                className={`relative flex items-center gap-1.5 px-3 py-2 my-2 rounded-xl text-sm font-medium transition ${
                  active ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'text-muted hover:text-ink hover:bg-cream'
                }`}>
                <Icon className="w-4 h-4" />
                {t(a.labelKey)}
                {a.href === '/admin/requests' && pending > 0 && (
                  <span className="ml-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-danger text-white text-[10px] font-bold">{pending}</span>
                )}
              </Link>
            )
          })}
          <div className="ml-2"><LangSwitcher /></div>
          <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-2 my-2 rounded-xl text-sm text-muted hover:text-danger transition">
            <LogOut className="w-4 h-4" /> {t("account.logout")}
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button onClick={() => setOpen(o => !o)} className="md:hidden text-ink p-2 -mr-2" aria-label="Menu">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sub-nav — only where an area has more than one screen */}
      {subLinks && (
        <div className="hidden md:flex items-center gap-1 px-6 pb-2 -mt-1">
          {subLinks.map(l => {
            const active = router.pathname === l.href
            return (
              <Link key={l.href} href={l.href}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  active ? 'bg-rose/10 text-rose' : 'text-muted hover:text-ink hover:bg-cream'
                }`}>
                {t(l.labelKey)}
              </Link>
            )
          })}
        </div>
      )}

      {/* Mobile menu — areas with their sub-screens indented under them */}
      {open && (
        <nav className="md:hidden border-t border-gray-100 px-3 py-2 space-y-1">
          {areas.map(a => {
            const active = activeArea?.href === a.href
            const Icon = a.icon
            return (
              <div key={a.href}>
                <Link href={a.href} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition ${
                    active ? 'bg-gradient-to-br from-rose to-peach text-white' : 'text-ink hover:bg-cream'
                  }`}>
                  <Icon className="w-5 h-5" />
                  {t(a.labelKey)}
                  {a.href === '/admin/requests' && pending > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 px-1.5 grid place-items-center rounded-full bg-danger text-white text-xs font-bold">{pending}</span>
                  )}
                </Link>
                {SUB[a.href] && (
                  <div className="pl-11 py-1 flex flex-wrap gap-1">
                    {SUB[a.href].map(l => (
                      <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                          router.pathname === l.href ? 'bg-rose/10 text-rose' : 'text-muted hover:bg-cream'
                        }`}>
                        {t(l.labelKey)}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-danger hover:bg-cream transition">
            <LogOut className="w-5 h-5" /> {t("account.logout")}
          </button>
        </nav>
      )}
    </header>
  )
}
