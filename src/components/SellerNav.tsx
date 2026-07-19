import Link from 'next/link'
import { useRouter } from 'next/router'
import { House, Receipt, Wallet, Settings } from 'lucide-react'

const items = [
  { href: '/seller',          label: 'Bosh sahifa', icon: House },
  // "Sotish" tab commented out — selling is done from the "Sotildi" button on each product
  // card on the home page, so a separate tab is redundant. (/seller/sell still works.)
  // { href: '/seller/sell',     label: 'Sotish',      icon: ShoppingBag },
  { href: '/seller/sales',    label: 'Sotuvlarim',  icon: Receipt },
  { href: '/seller/balance',  label: 'Hisobim',     icon: Wallet },
  { href: '/seller/settings', label: 'Sozlamalar',  icon: Settings },
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
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition ${active ? 'text-rose' : 'text-muted hover:text-rose'}`}>
            <Icon className="w-[22px] h-[22px]" />
            <span className="text-[10px] font-medium leading-none">{it.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
