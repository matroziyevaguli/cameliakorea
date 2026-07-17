import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/api'

// Admin approves or rejects a seller's sale-price-change request.
// Approve writes the new unit_price to the sale; money views recompute automatically.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: "Ruxsat yo'q" })

  const svc = createServiceClient()
  const { data: prof } = await svc.from('profiles').select('id, role').eq('user_id', user.id).single()
  if (!prof || prof.role !== 'admin') return res.status(403).json({ error: 'Faqat admin' })

  const { id, action, admin_note } = req.body as {
    id?: string; action?: 'approve' | 'reject'; admin_note?: string
  }
  if (!id || (action !== 'approve' && action !== 'reject')) {
    return res.status(400).json({ error: 'id va action kerak' })
  }

  const { data: reqRow } = await svc.from('sale_price_requests').select('*').eq('id', id).single()
  if (!reqRow) return res.status(404).json({ error: 'So\'rov topilmadi' })
  if (reqRow.status !== 'pending') return res.status(409).json({ error: 'Bu so\'rov allaqachon ko\'rib chiqilgan' })

  if (action === 'approve') {
    if (reqRow.requested_price < 0) return res.status(400).json({ error: "Narx manfiy bo'lolmaydi" })
    const { error: upErr } = await svc.from('sales')
      .update({ unit_price: reqRow.requested_price }).eq('id', reqRow.sale_id)
    if (upErr) return res.status(400).json({ error: upErr.message })
  }

  const { error } = await svc.from('sale_price_requests').update({
    status:      action === 'approve' ? 'approved' : 'rejected',
    admin_note:  admin_note?.trim() || null,
    resolved_at: new Date().toISOString(),
    resolved_by: prof.id,
  }).eq('id', id)
  if (error) return res.status(400).json({ error: error.message })

  return res.status(200).json({ ok: true })
}
