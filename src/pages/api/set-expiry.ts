import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/api'

// A seller (or admin) sets a product's expiry date. A seller may only set it for a
// product allocated to her, and only the expiry_date field — never price/cost.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: "Ruxsat yo'q" })

  const { product_id, expiry_date } = req.body as { product_id?: string; expiry_date?: string | null }
  if (!product_id) return res.status(400).json({ error: 'product_id required' })

  const svc = createServiceClient()
  const { data: prof } = await svc.from('profiles').select('id, role').eq('user_id', user.id).single()
  if (!prof) return res.status(403).json({ error: "Ruxsat yo'q" })

  // Sellers may only touch products allocated to them
  if (prof.role !== 'admin') {
    const { data: alloc } = await svc.from('allocations').select('id').eq('seller_id', prof.id).eq('product_id', product_id).maybeSingle()
    if (!alloc) return res.status(403).json({ error: "Bu mahsulot sizga biriktirilmagan" })
  }

  const { error } = await svc.from('products').update({ expiry_date: expiry_date || null }).eq('id', product_id)
  if (error) return res.status(400).json({ error: error.message })

  return res.status(200).json({ ok: true })
}
