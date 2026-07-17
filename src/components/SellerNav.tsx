import Link from 'next/link'
import { useRouter } from 'next/router'
import { ShoppingBag, History, ClipboardList, Wallet } from 'lucide-react'

const items = [
  { href: '/seller',          label: 'Mahsulotlar', icon: ShoppingBag },
  { href: '/seller/sales',    label: 'Tarix',       icon: History },
  { href: '/seller/requests', label: "So'rovlarim", icon: ClipboardList },
  { href: '/seller/balance',  label: 'Hisobim',     icon: Wallet },
]

export default function SellerNav() {
  const router = useRouter()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-100 flex z-20 shadow-card">
      {items.map(it => {
        const active = router.pathname === it.href
        const Icon = it.icon
        return (
          <Link key={it.href} href={it.href}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition ${active ? 'text-rose' : 'text-muted hover:text-rose'}`}>
            <Icon className="w-5 h-5" />
            <span className="text-[11px] font-medium">{it.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
