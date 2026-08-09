// Client-side cart (localStorage). Anonymous until checkout — survey/browsing stay login-free.
// A window event keeps every mounted useCart() in sync (badge, drawer, checkout).
import { useEffect, useState, useCallback } from 'react'

export type CartItem = { id: string; name: string; price: number; image_url: string | null; qty: number }

const KEY = 'camelia_cart'
const EVENT = 'camelia_cart_change'

function read(): CartItem[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function write(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
  window.dispatchEvent(new Event(EVENT))
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    const sync = () => setItems(read())
    sync()
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)   // other tabs
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])

  const add = useCallback((p: Omit<CartItem, 'qty'>, qty = 1) => {
    const items = read()
    const found = items.find(i => i.id === p.id)
    if (found) found.qty += qty
    else items.push({ ...p, qty })
    write(items)
  }, [])

  const setQty = useCallback((id: string, qty: number) => {
    let items = read()
    if (qty <= 0) items = items.filter(i => i.id !== id)
    else items = items.map(i => i.id === id ? { ...i, qty } : i)
    write(items)
  }, [])

  const remove = useCallback((id: string) => write(read().filter(i => i.id !== id)), [])
  const clear = useCallback(() => write([]), [])

  const count = items.reduce((n, i) => n + i.qty, 0)
  const total = items.reduce((n, i) => n + i.qty * i.price, 0)
  return { items, add, setQty, remove, clear, count, total }
}
