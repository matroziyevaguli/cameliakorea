import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/lib/cart'

// Cart icon for the header (badge with item count). Always visible; links to /savat.
export default function HeaderCart() {
  const { count } = useCart()
  return (
    <Link href="/savat" aria-label="Savat"
      className="relative w-10 h-10 rounded-full bg-white shadow-card grid place-items-center text-ink active:scale-95 transition">
      <ShoppingBag className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose text-white text-[11px] font-bold grid place-items-center">{count}</span>
      )}
    </Link>
  )
}
