import type { NextApiRequest, NextApiResponse } from 'next'
import { createServiceClient } from '@/lib/supabase/api'
import { getApiUser } from '@/lib/apiAuth'
import { notifyOwner } from '@/lib/telegram'

// Admin-only order actions. Confirm goes through the atomic confirm_order() RPC (→ seller sale);
// the rest are simple status/assignment updates.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: 'Kirish talab qilinadi' })
  const supabase = createServiceClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Ruxsat yo\'q' })

  const { orderId, action, seller_id, reason } = req.body ?? {}
  if (!orderId || !action) return res.status(400).json({ error: "Ma'lumot yetarli emas" })

  try {
    switch (action) {
      case 'confirm': {
        const { error } = await supabase.rpc('confirm_order', { p_order_id: orderId })
        if (error) return res.status(409).json({ error: error.message })
        notifyOwner('✅ Buyurtma tasdiqlandi va sotuvga yozildi.')
        break
      }
      case 'reject': {
        const { error } = await supabase.from('orders')
          .update({ status: 'awaiting_payment_retry', rejection_reason: reason?.trim() || 'Chek qabul qilinmadi' })
          .eq('id', orderId)
        if (error) return res.status(500).json({ error: error.message })
        break
      }
      case 'assign': {
        if (!seller_id) return res.status(400).json({ error: 'Sotuvchi tanlanmagan' })
        const { error } = await supabase.from('orders').update({ assigned_seller_id: seller_id }).eq('id', orderId)
        if (error) return res.status(500).json({ error: error.message })
        break
      }
      case 'delivering':
      case 'delivered':
      case 'cancelled': {
        const patch: any = { status: action }
        if (action === 'delivered') patch.delivered_at = new Date().toISOString()
        const { error } = await supabase.from('orders').update(patch).eq('id', orderId)
        if (error) return res.status(500).json({ error: error.message })
        break
      }
      default:
        return res.status(400).json({ error: 'Nomaʼlum amal' })
    }
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'Xatolik' })
  }

  return res.status(200).json({ ok: true })
}
