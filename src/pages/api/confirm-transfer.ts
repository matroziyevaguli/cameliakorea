import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/api'

// The RECEIVING seller confirms (or rejects) an incoming return. On confirm, the units move
// from the sender to her. Admin is not involved — she's the one receiving.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: "Ruxsat yo'q" })

  const { id, action } = req.body as { id?: string; action?: 'approve' | 'reject' }
  if (!id || (action !== 'approve' && action !== 'reject')) {
    return res.status(400).json({ error: 'id va action kerak' })
  }

  const svc = createServiceClient()
  const { data: prof } = await svc.from('profiles').select('id').eq('user_id', user.id).single()
  if (!prof) return res.status(403).json({ error: "Ruxsat yo'q" })

  const { data: t } = await svc.from('transfers').select('id, to_seller_id, status').eq('id', id).single()
  if (!t) return res.status(404).json({ error: "So'rov topilmadi" })
  if (t.to_seller_id !== prof.id) return res.status(403).json({ error: "Bu qaytarish sizga emas" })
  if (t.status !== 'pending') return res.status(409).json({ error: "Bu so'rov allaqachon ko'rib chiqilgan" })

  if (action === 'approve') {
    const { error } = await svc.rpc('approve_transfer', { p_id: id, p_resolved_by: prof.id })
    if (error) {
      const m = error.message || ''
      const friendly = /unsold units/i.test(m) ? "Yuboruvchida yetarli sotilmagan mahsulot yo'q"
        : /already handled|not found/i.test(m) ? "Bu so'rov allaqachon ko'rib chiqilgan"
        : m
      return res.status(400).json({ error: friendly })
    }
  } else {
    const { error } = await svc.from('transfers').update({
      status: 'rejected', resolved_at: new Date().toISOString(), resolved_by: prof.id,
    }).eq('id', id).eq('status', 'pending')
    if (error) return res.status(400).json({ error: error.message })
  }

  return res.status(200).json({ ok: true })
}
