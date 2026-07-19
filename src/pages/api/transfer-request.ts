import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/api'

// A seller returns UNSOLD units to another seller (usually the main seller). Creates a PENDING
// transfer — nothing moves until the admin approves. No money is involved (unsold units).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: "Ruxsat yo'q" })

  const { product_id, to_seller_id, qty, note } = req.body as {
    product_id?: string; to_seller_id?: string; qty?: number; note?: string
  }
  if (!product_id || !to_seller_id || !qty || Number(qty) <= 0) {
    return res.status(400).json({ error: "Mahsulot, qabul qiluvchi va son kerak" })
  }

  const svc = createServiceClient()
  const { data: prof } = await svc.from('profiles').select('id, full_name').eq('user_id', user.id).single()
  if (!prof) return res.status(403).json({ error: "Ruxsat yo'q" })
  if (to_seller_id === prof.id) return res.status(400).json({ error: "O'zingizga qaytarib bo'lmaydi" })

  // remaining = allocated - sold - adjusted; she can't return more than she actually holds.
  const [{ data: alloc }, { data: sales }, { data: adj }] = await Promise.all([
    svc.from('allocations').select('qty_allocated').eq('seller_id', prof.id).eq('product_id', product_id).maybeSingle(),
    svc.from('sales').select('qty').eq('seller_id', prof.id).eq('product_id', product_id),
    svc.from('stock_adjustments').select('qty').eq('seller_id', prof.id).eq('product_id', product_id),
  ])
  const remaining = (alloc?.qty_allocated ?? 0)
    - (sales ?? []).reduce((n, s) => n + s.qty, 0)
    - (adj ?? []).reduce((n, a) => n + (a.qty ?? 0), 0)
  if (Number(qty) > remaining) {
    return res.status(400).json({ error: `Sizda faqat ${remaining} ta sotilmagan bor` })
  }

  // The request goes to the RECEIVING seller to confirm (she sees it in her app) — not to
  // the admin. We don't Telegram anyone here (only the owner's chat id is stored).
  const { error } = await svc.from('transfers').insert({
    from_seller_id: prof.id, to_seller_id, product_id, qty: Number(qty), note: note?.trim() || null,
  })
  if (error) return res.status(400).json({ error: error.message })

  return res.status(200).json({ ok: true })
}
