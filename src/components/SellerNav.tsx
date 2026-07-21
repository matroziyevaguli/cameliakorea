import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { House, Receipt, Wallet, RotateCcw } from 'lucide-react'

// Four tabs (redesign.md §4.0). Settings lives behind the ⚙ in the page header and
// Requests behind 🔔 — neither competes for a tab slot, so the four that remain get
// big, thumb-friendly targets.
const items = [
  { href: '/seller',           label: 'Sotish',     icon: House },
  { href: '/seller/sales',     label: 'Sotuvlarim', icon: Receipt },
  { href: '/seller/balance',   label: 'Hisobim',    icon: Wallet },
  { href: '/seller/transfers', label: 'Qaytarish',  icon: RotateCcw },
]

export default function SellerNav() {
  const router = useRouter()
  const [incoming, setIncoming] = useState(0)

  // Red badge on Qaytarish = returns waiting for THIS seller to confirm.
  useEffect(() => {
    const supabase = createClient()
    const count = () => supabase.from('v_my_transfers').select('id', { count: 'exact', head: true })
      .eq('is_outgoing', false).eq('status', 'pending')
      .then(({ count }) => setIncoming(count ?? 0), () => {})
    count()
    window.addEventListener('camelia-transfers-changed', count)
    return () => window.removeEventListener('camelia-transfers-changed', count)
  }, [router.pathname])

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-100 flex z-20 shadow-card">
      {items.map(it => {
        const active = router.pathname === it.href
        const Icon = it.icon
        return (
          <Link key={it.href} href={it.href}
            className={`relative flex-1 flex flex-col items-center gap-1 py-3 transition ${active ? 'text-rose' : 'text-muted hover:text-rose'}`}>
            <Icon className="w-6 h-6" />
            {it.href === '/seller/transfers' && incoming > 0 && (
              <span className="absolute top-2 right-[24%] min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-danger text-white text-[9px] font-bold">{incoming}</span>
            )}
            <span className="text-[11px] font-medium leading-none">{it.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
