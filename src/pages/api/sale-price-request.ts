import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/api'
import { formatUZS } from '@/lib/format'

// A seller asks to correct the PRICE of one of her sales. Creates a PENDING request —
// the sale's unit_price is NOT changed until the admin approves. Pings the owner.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: "Ruxsat yo'q" })

  const { sale_id, requested_price, reason } = req.body as {
    sale_id?: string; requested_price?: number; reason?: string
  }
  if (!sale_id || requested_price == null || Number(requested_price) < 0) {
    return res.status(400).json({ error: "Sotuv va to'g'ri narx kiritilishi shart" })
  }

  const svc = createServiceClient()
  const { data: prof } = await svc.from('profiles').select('id, full_name, role').eq('user_id', user.id).single()
  if (!prof) return res.status(403).json({ error: "Ruxsat yo'q" })

  const { data: sale } = await svc.from('sales')
    .select('id, seller_id, product_id, unit_price, qty').eq('id', sale_id).single()
  if (!sale) return res.status(404).json({ error: 'Sotuv topilmadi' })
  if (prof.role !== 'admin' && sale.seller_id !== prof.id) {
    return res.status(403).json({ error: 'Bu sizning sotuvingiz emas' })
  }

  const { error } = await svc.from('sale_price_requests').insert({
    sale_id,
    seller_id:       sale.seller_id,
    current_price:   sale.unit_price,
    requested_price: Number(requested_price),
    reason:          reason?.trim() || null,
  })
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Bu sotuv uchun narx so\'rovi allaqachon yuborilgan' })
    return res.status(400).json({ error: error.message })
  }

  const ownerChat = process.env.TELEGRAM_OWNER_CHAT_ID
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (ownerChat && token) {
    const { data: product } = await svc.from('products').select('name').eq('id', sale.product_id).single()
    const reasonLine = reason?.trim() ? `\nSabab: ${reason.trim()}` : ''
    const msg = `💵 NARX SO'ROVI\n${prof.full_name}: "${product?.name ?? ''}" — ${formatUZS(sale.unit_price)} → ${formatUZS(Number(requested_price))}${reasonLine}`
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ownerChat, text: msg }),
    }).catch(() => {})
  }

  return res.status(200).json({ ok: true })
}
