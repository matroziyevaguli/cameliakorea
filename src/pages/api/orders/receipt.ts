import type { NextApiRequest, NextApiResponse } from 'next'
import { createServiceClient } from '@/lib/supabase/api'
import { getCustomer } from '@/lib/customerAuth'
import { notifyOwner } from '@/lib/telegram'

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } }

// Customer uploads the bank-transfer receipt for their own order → moves it to
// awaiting_confirmation for the admin to verify. Private bucket; admin views via signed URL.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const customer = await getCustomer(req)
  if (!customer) return res.status(401).json({ error: 'Avval tizimga kiring' })

  const { orderId, imageBase64 } = req.body ?? {}
  if (!orderId || !imageBase64) return res.status(400).json({ error: 'Chek rasmi kerak' })

  const supabase = createServiceClient()
  const { data: order } = await supabase.from('orders')
    .select('id, customer_id, status').eq('id', orderId).single()
  if (!order || order.customer_id !== customer.id) return res.status(404).json({ error: 'Buyurtma topilmadi' })
  if (!['pending_payment', 'awaiting_payment_retry', 'awaiting_confirmation'].includes(order.status))
    return res.status(409).json({ error: 'Bu buyurtma uchun chek qabul qilinmaydi' })

  const base64 = String(imageBase64).replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')
  const path = `${orderId}.jpg`
  const { error: upErr } = await supabase.storage.from('order-receipts')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })
  if (upErr) return res.status(500).json({ error: `Rasm yuklashda xatolik: ${upErr.message}` })

  const { error } = await supabase.from('orders').update({
    receipt_url: path, status: 'awaiting_confirmation', paid_at: new Date().toISOString(), rejection_reason: null,
  }).eq('id', orderId)
  if (error) return res.status(500).json({ error: error.message })

  notifyOwner('🧾 Yangi buyurtma cheki yuklandi — tasdiqlash kutilmoqda (/admin/orders).')
  return res.status(200).json({ ok: true })
}
