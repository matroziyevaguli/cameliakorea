import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@/lib/supabase/browser'
import { LayoutDashboard, Package, Layers, Share2, Users, CreditCard, BarChart2, Inbox, Gift, LogOut, Menu, X } from 'lucide-react'

const links = [
  { href: '/admin',             label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/admin/products',    label: 'Mahsulotlar',  icon: Package },
  { href: '/admin/batches',     label: 'Partiyalar',   icon: Layers },
  { href: '/admin/distribute',  label: 'Taqsimlash',   icon: Share2 },
  { href: '/admin/requests',    label: "So'rovlar",    icon: Inbox },
  { href: '/admin/giveaways',   label: "Sovg'alar",    icon: Gift },
  { href: '/admin/sellers',     label: 'Sotuvchilar',  icon: Users },
  { href: '/admin/payments',    label: "To'lovlar",    icon: CreditCard },
  { href: '/admin/stats',       label: 'Statistika',   icon: BarChart2 },
]

export default function AdminNav() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(0)

  // Live count of pending requests (allocation + price) → red badge on the So'rovlar tab.
  // Re-counts on navigation and whenever a request is resolved (custom event).
  useEffect(() => {
    const supabase = createClient()
    const count = () => Promise.all([
      supabase.from('allocation_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('sale_price_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('transfers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]).then(([a, b, c]) => setPending((a.count ?? 0) + (b.count ?? 0) + (c.count ?? 0))).catch(() => {})
    count()
    window.addEventListener('camelia-requests-changed', count)
    return () => window.removeEventListener('camelia-requests-changed', count)
  }, [router.pathname])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="bg-surface border-b border-gray-100 shadow-sm sticky top-0 z-30">
      <div className="px-4 md:px-6 flex items-center justify-between">
        <Link href="/admin" className="font-display font-bold text-ink text-lg py-4 flex items-center gap-2">
          <span className="text-rose">✦</span> Camelia <span className="hidden sm:inline">Admin</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map(l => {
            const active = router.pathname === l.href
            const Icon = l.icon
            return (
              <Link key={l.href} href={l.href}
                className={`relative flex items-center gap-1.5 px-3 py-2 my-2 rounded-xl text-sm font-medium transition ${
                  active ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'text-muted hover:text-ink hover:bg-cream'
                }`}>
                <Icon className="w-4 h-4" />
                {l.label}
                {l.href === '/admin/requests' && pending > 0 && (
                  <span className="ml-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-danger text-white text-[10px] font-bold">{pending}</span>
                )}
              </Link>
            )
          })}
          <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-2 my-2 rounded-xl text-sm text-muted hover:text-danger transition ml-2">
            <LogOut className="w-4 h-4" /> Chiqish
          </button>
        </nav>

        {/* Mobile hamburger */}
        <button onClick={() => setOpen(o => !o)} className="md:hidden text-ink p-2 -mr-2" aria-label="Menu">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {open && (
        <nav className="md:hidden border-t border-gray-100 px-3 py-2 space-y-1">
          {links.map(l => {
            const active = router.pathname === l.href
            const Icon = l.icon
            return (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition ${
                  active ? 'bg-gradient-to-br from-rose to-peach text-white' : 'text-ink hover:bg-cream'
                }`}>
                <Icon className="w-5 h-5" />
                {l.label}
                {l.href === '/admin/requests' && pending > 0 && (
                  <span className="ml-auto min-w-[20px] h-5 px-1.5 grid place-items-center rounded-full bg-danger text-white text-xs font-bold">{pending}</span>
                )}
              </Link>
            )
          })}
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-danger hover:bg-cream transition">
            <LogOut className="w-5 h-5" /> Chiqish
          </button>
        </nav>
      )}
    </header>
  )
}
