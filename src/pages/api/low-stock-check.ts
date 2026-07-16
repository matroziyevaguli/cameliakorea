import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/api'

// Called after a sale. Sends the OWNER a private Telegram alert when a product
// crosses into low stock or sells out — once per crossing, not on every sale.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await getApiUser(req))) return res.status(401).json({ error: "Ruxsat yo'q" })

  const ownerChat = process.env.TELEGRAM_OWNER_CHAT_ID
  const token = process.env.TELEGRAM_BOT_TOKEN
  // Not configured → silently skip (feature is optional).
  if (!ownerChat || !token) return res.status(200).json({ ok: true, skipped: true })

  const { product_id, qty } = req.body as { product_id?: string; qty?: number }
  if (!product_id) return res.status(400).json({ error: 'product_id required' })

  const threshold = Number(process.env.LOW_STOCK_THRESHOLD ?? 3)
  const svc = createServiceClient()

  const { data: prod } = await svc.from('products').select('name, total_qty').eq('id', product_id).single()
  if (!prod) return res.status(200).json({ ok: true })

  const [{ data: sales }, { data: adj }] = await Promise.all([
    svc.from('sales').select('qty').eq('product_id', product_id),
    svc.from('stock_adjustments').select('qty').eq('product_id', product_id),
  ])
  const sold = (sales ?? []).reduce((n, s) => n + s.qty, 0)
  const adjusted = (adj ?? []).reduce((n, a) => n + (a.qty ?? 0), 0)

  const remainingAfter = prod.total_qty - sold - adjusted
  const remainingBefore = remainingAfter + Number(qty || 0)

  let msg: string | null = null
  if (remainingAfter <= 0 && remainingBefore > 0) {
    msg = `❌ TUGADI: "${prod.name}" — mahsulot butunlay tugadi!`
  } else if (remainingAfter <= threshold && remainingBefore > threshold) {
    msg = `⚠️ KAM QOLDI: "${prod.name}" — atigi ${remainingAfter} ta qoldi. Yangi partiya kerak bo'lishi mumkin.`
  }

  if (msg) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ownerChat, text: msg }),
    })
  }

  return res.status(200).json({ ok: true, alerted: !!msg })
}
