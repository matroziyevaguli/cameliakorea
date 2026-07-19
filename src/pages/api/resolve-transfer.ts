import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser, createUserClient } from '@/lib/apiAuth'

// Admin approves or rejects a transfer. Approve runs the atomic approve_transfer() RPC AS the
// admin (so its internal is_admin() check passes); it moves the allocation A→B and re-checks
// the sender still holds enough unsold units.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: "Ruxsat yo'q" })

  const db = createUserClient(req)   // carries the admin's session → RLS + is_admin() apply
  const { data: prof } = await db.from('profiles').select('id, role').eq('user_id', user.id).single()
  if (!prof || prof.role !== 'admin') return res.status(403).json({ error: 'Faqat admin' })

  const { id, action, admin_note } = req.body as {
    id?: string; action?: 'approve' | 'reject'; admin_note?: string
  }
  if (!id || (action !== 'approve' && action !== 'reject')) {
    return res.status(400).json({ error: 'id va action kerak' })
  }

  if (action === 'approve') {
    const { error } = await db.rpc('approve_transfer', { p_id: id })
    if (error) {
      const m = error.message || ''
      const friendly = /unsold units/i.test(m) ? 'Sotuvchida yetarli sotilmagan mahsulot yo\'q'
        : /already handled|not found/i.test(m) ? 'Bu so\'rov allaqachon ko\'rib chiqilgan'
        : m
      return res.status(400).json({ error: friendly })
    }
  } else {
    const { error } = await db.from('transfers').update({
      status: 'rejected', admin_note: admin_note?.trim() || null,
      resolved_at: new Date().toISOString(), resolved_by: prof.id,
    }).eq('id', id).eq('status', 'pending')
    if (error) return res.status(400).json({ error: error.message })
  }

  return res.status(200).json({ ok: true })
}
