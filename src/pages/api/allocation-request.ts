import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/api'

// A seller asks to correct how many units she actually received of a product.
// Creates a PENDING request — the allocation is NOT touched until the admin approves.
// Also pings the owner on Telegram.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: "Ruxsat yo'q" })

  const { product_id, requested_qty, reason, type: rawType } = req.body as {
    product_id?: string; requested_qty?: number; reason?: string; type?: string
  }
  const type = rawType === 'new_product' ? 'new_product' : 'correction'
  if (!product_id || requested_qty == null || Number(requested_qty) < 0) {
    return res.status(400).json({ error: "Mahsulot va to'g'ri son kiritilishi shart" })
  }

  const svc = createServiceClient()
  const { data: prof } = await svc.from('profiles').select('id, full_name, role').eq('user_id', user.id).single()
  if (!prof) return res.status(403).json({ error: "Ruxsat yo'q" })

  // Current allocation for context (0 if none).
  const { data: alloc } = await svc.from('allocations')
    .select('qty_allocated').eq('seller_id', prof.id).eq('product_id', product_id).maybeSingle()
  const currentQty = alloc?.qty_allocated ?? 0

  // Product name for the notification.
  const { data: product } = await svc.from('products').select('name').eq('id', product_id).single()

  const { error } = await svc.from('allocation_requests').insert({
    seller_id:     prof.id,
    product_id,
    type,
    current_qty:   currentQty,
    requested_qty: Number(requested_qty),
    reason:        reason?.trim() || null,
  })
  if (error) {
    // Unique partial index → she already has a pending request for this product.
    if (error.code === '23505') return res.status(409).json({ error: 'Bu mahsulot uchun so\'rov allaqachon yuborilgan' })
    return res.status(400).json({ error: error.message })
  }

  // Fire-and-forget Telegram ping to the owner.
  const ownerChat = process.env.TELEGRAM_OWNER_CHAT_ID
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (ownerChat && token) {
    const reasonLine = reason?.trim() ? `\nSabab: ${reason.trim()}` : ''
    const msg = type === 'new_product'
      ? `🆕 YANGI MAHSULOT SO'ROVI\n${prof.full_name}: "${product?.name ?? ''}" — ${requested_qty} ta so'radi${reasonLine}`
      : `✏️ TUZATISH SO'ROVI\n${prof.full_name}: "${product?.name ?? ''}" — ${currentQty} → ${requested_qty} ta${reasonLine}`
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ownerChat, text: msg }),
    }).catch(() => {})
  }

  return res.status(200).json({ ok: true })
}
