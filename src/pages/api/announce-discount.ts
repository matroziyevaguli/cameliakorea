import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/api'
import { formatUZS } from '@/lib/format'

// Posts a discount announcement to the public buyers channel (@cameliakorea).
// Admin-only. Purely a message — never touches sales/allocations/profit.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: "Ruxsat yo'q" })

  const svc = createServiceClient()
  const { data: prof } = await svc.from('profiles').select('role').eq('user_id', user.id).single()
  if (!prof || prof.role !== 'admin') return res.status(403).json({ error: 'Faqat admin' })

  const { product_id } = req.body as { product_id?: string }
  if (!product_id) return res.status(400).json({ error: 'product_id required' })

  const { data: p } = await svc.from('products')
    .select('name, retail_price, discount_price, image_url, link').eq('id', product_id).single()
  if (!p) return res.status(404).json({ error: 'Mahsulot topilmadi' })
  if (p.discount_price == null) return res.status(400).json({ error: 'Chegirma narxi yo\'q' })

  const token = process.env.TELEGRAM_BOT_TOKEN
  const channel = process.env.TELEGRAM_CHANNEL
  if (!token || !channel) {
    const missing = [!token && 'TELEGRAM_BOT_TOKEN', !channel && 'TELEGRAM_CHANNEL'].filter(Boolean).join(', ')
    return res.status(500).json({ error: `Telegram credentials not configured (missing: ${missing})` })
  }

  const off = p.retail_price > 0 ? Math.round((1 - p.discount_price / p.retail_price) * 100) : 0
  const caption =
    `🔥 CHEGIRMA${off > 0 ? ` −${off}%` : ''}!\n\n` +
    `${p.name}\n` +
    `💰 ${formatUZS(p.retail_price)}  →  🏷️ ${formatUZS(p.discount_price)}\n\n` +
    `⚠️ Mahsulot soni cheklangan!\n\n` +
    `📞 Buyurtma uchun:\n` +
    `🏙 Namangan: Gulshanoy +998 94 099 44 99\n` +
    `🏙 Andijon: Saida +998 93 858 27 27\n` +
    `🏙 Farg'ona: Adolat +998 33 408 61 83\n\n` +
    `@cameliakorea`

  const body: Record<string, unknown> = { chat_id: channel }
  const method = p.image_url ? 'sendPhoto' : 'sendMessage'
  if (p.image_url) { body.photo = p.image_url; body.caption = caption }
  else { body.text = caption }
  if (p.link) body.reply_markup = { inline_keyboard: [[{ text: "▶️ Videoni ko'rish", url: p.link }]] }

  const tg = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await tg.json()
  if (!data.ok) return res.status(502).json({ error: data.description ?? 'Telegram error' })

  return res.status(200).json({ ok: true })
}
