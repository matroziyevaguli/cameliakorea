import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/api'

// Admin approves or rejects a seller's allocation-correction request.
// Approve applies the corrected qty to `allocations` — guarded so it can't drop below what
// she's already sold, and the DB trigger blocks going over the product's total stock.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: "Ruxsat yo'q" })

  const svc = createServiceClient()
  const { data: prof } = await svc.from('profiles').select('id, role').eq('user_id', user.id).single()
  if (!prof || prof.role !== 'admin') return res.status(403).json({ error: "Faqat admin" })

  const { id, action, admin_note, bump_stock } = req.body as {
    id?: string; action?: 'approve' | 'reject'; admin_note?: string; bump_stock?: boolean
  }
  if (!id || (action !== 'approve' && action !== 'reject')) {
    return res.status(400).json({ error: 'id va action kerak' })
  }

  const { data: reqRow } = await svc.from('allocation_requests').select('*').eq('id', id).single()
  if (!reqRow) return res.status(404).json({ error: 'So\'rov topilmadi' })
  if (reqRow.status !== 'pending') return res.status(409).json({ error: 'Bu so\'rov allaqachon ko\'rib chiqilgan' })

  if (action === 'approve') {
    // Floor guard: can't set below what she's already sold.
    const { data: sales } = await svc.from('sales')
      .select('qty').eq('seller_id', reqRow.seller_id).eq('product_id', reqRow.product_id)
    const sold = (sales ?? []).reduce((n, s) => n + s.qty, 0)
    if (reqRow.requested_qty < sold) {
      return res.status(400).json({ error: `${sold} ta sotilgan — bundan kam qilib bo'lmaydi` })
    }

    // Stock-cap: OTHER sellers' allocations + this request must fit the product's stock.
    const [{ data: product }, { data: allocs }] = await Promise.all([
      svc.from('products').select('total_qty').eq('id', reqRow.product_id).single(),
      svc.from('allocations').select('seller_id, qty_allocated').eq('product_id', reqRow.product_id),
    ])
    const others = (allocs ?? [])
      .filter(a => a.seller_id !== reqRow.seller_id)
      .reduce((n, a) => n + a.qty_allocated, 0)
    const neededTotal = others + reqRow.requested_qty
    const stock = product?.total_qty ?? 0

    if (neededTotal > stock) {
      if (bump_stock) {
        // Admin chose to raise stock to fit — the original total_qty was under-counted too.
        const { error: bumpErr } = await svc.from('products').update({ total_qty: neededTotal }).eq('id', reqRow.product_id)
        if (bumpErr) return res.status(400).json({ error: bumpErr.message })
      } else {
        return res.status(409).json({
          error: `Tasdiqlansa jami taqsimot ${neededTotal} ta bo'ladi, lekin omborda ${stock} ta bor.`,
          need_stock: { needed: neededTotal, current: stock },
        })
      }
    }

    // Apply the corrected allocation (create or replace).
    const { error: upErr } = await svc.from('allocations').upsert(
      { seller_id: reqRow.seller_id, product_id: reqRow.product_id, qty_allocated: reqRow.requested_qty },
      { onConflict: 'seller_id,product_id', ignoreDuplicates: false },
    )
    if (upErr) return res.status(400).json({ error: upErr.message })
  }

  const { error } = await svc.from('allocation_requests').update({
    status:      action === 'approve' ? 'approved' : 'rejected',
    admin_note:  admin_note?.trim() || null,
    resolved_at: new Date().toISOString(),
    resolved_by: prof.id,
  }).eq('id', id)
  if (error) return res.status(400).json({ error: error.message })

  return res.status(200).json({ ok: true })
}
