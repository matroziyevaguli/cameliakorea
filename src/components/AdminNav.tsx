import Link from 'next/link'
import { useRouter } from 'next/router'
import { createClient } from '@/lib/supabase/browser'
import { LayoutDashboard, Package, Share2, Users, CreditCard, BarChart2, LogOut } from 'lucide-react'

const links = [
  { href: '/admin',             label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/admin/products',    label: 'Mahsulotlar',  icon: Package },
  { href: '/admin/distribute',  label: 'Taqsimlash',   icon: Share2 },
  { href: '/admin/sellers',     label: 'Sotuvchilar',  icon: Users },
  { href: '/admin/payments',    label: "To'lovlar",    icon: CreditCard },
  { href: '/admin/stats',       label: 'Statistika',   icon: BarChart2 },
]

export default function AdminNav() {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="bg-surface border-b border-gray-100 shadow-sm px-6 py-0 flex items-center justify-between sticky top-0 z-30">
      <Link href="/admin" className="font-display font-bold text-ink text-lg py-4 flex items-center gap-2">
        <span className="text-rose">✦</span> Camelia Admin
      </Link>
      <nav className="flex items-center gap-1">
        {links.map(l => {
          const active = router.pathname === l.href
          const Icon = l.icon
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-1.5 px-3 py-2 my-2 rounded-xl text-sm font-medium transition ${
                active
                  ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose'
                  : 'text-muted hover:text-ink hover:bg-cream'
              }`}
            >
              <Icon className="w-4 h-4" />
              {l.label}
            </Link>
          )
        })}
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 px-3 py-2 my-2 rounded-xl text-sm text-muted hover:text-danger transition ml-2"
        >
          <LogOut className="w-4 h-4" />
          Chiqish
        </button>
      </nav>
    </header>
  )
}
