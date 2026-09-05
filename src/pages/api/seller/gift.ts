import type { NextApiRequest, NextApiResponse } from 'next'
import { createServiceClient } from '@/lib/supabase/api'
import { getApiUser } from '@/lib/apiAuth'

// A seller gives product away as a gift ("Sovg'a"). Recorded as a stock_adjustment
// (reason 'gift') — stock goes down, no revenue, and the seller owes nothing (the business
// absorbs the cost). Sellers can't write stock_adjustments directly (RLS), so this runs as
// the service role after verifying the caller is a seller and has the stock.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: 'Kirish talab qilinadi' })
  const supabase = createServiceClient()
  const { data: profile } = await supabase.from('profiles').select('id, role').eq('user_id', user.id).single()
  if (!profile || profile.role !== 'seller') return res.status(403).json({ error: 'Ruxsat yo\'q' })

  const { product_id, qty, name, phone } = req.body ?? {}
  const n = Number(qty)
  if (!product_id || !Number.isFinite(n) || n < 1) return res.status(400).json({ error: 'Mahsulot va sonni tanlang' })
  if (!(name ?? '').trim() || !(phone ?? '').trim()) return res.status(400).json({ error: 'Kimga va telefon raqamini kiriting' })

  // Remaining in this seller's hands = allocated − sold − already-adjusted.
  const sid = profile.id
  const [alloc, sales, adj] = await Promise.all([
    supabase.from('allocations').select('qty_allocated').eq('seller_id', sid).eq('product_id', product_id).maybeSingle(),
    supabase.from('sales').select('qty').eq('seller_id', sid).eq('product_id', product_id).is('cancelled_at', null),
    supabase.from('stock_adjustments').select('qty').eq('seller_id', sid).eq('product_id', product_id),
  ])
  const allocated = alloc.data?.qty_allocated ?? 0
  const sold = (sales.data ?? []).reduce((s: number, r: any) => s + (r.qty || 0), 0)
  const adjusted = (adj.data ?? []).reduce((s: number, r: any) => s + (r.qty || 0), 0)
  const remaining = allocated - sold - adjusted
  if (n > remaining) return res.status(409).json({ error: `Sizda faqat ${Math.max(0, remaining)} ta bor` })

  const { error } = await supabase.from('stock_adjustments').insert({
    seller_id: sid, product_id, qty: n, reason: 'gift',
    winner: name.trim(), note: phone.trim(),
  })
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true })
}
