import Link from 'next/link'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/lib/cart'

// Floating cart button — shows the item count and links to /savat. Dropped on the storefront,
// product, and survey pages so the cart is always reachable.
export default function CartFab() {
  const { count } = useCart()
  if (count === 0) return null
  return (
    <Link href="/savat" aria-label="Savat"
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-rose to-peach text-white grid place-items-center shadow-rose active:scale-95 transition">
      <ShoppingBag className="w-6 h-6" />
      <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1.5 rounded-full bg-ink text-white text-xs font-bold grid place-items-center">{count}</span>
    </Link>
  )
}
