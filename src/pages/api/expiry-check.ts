import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/api'
import { expiryInfo } from '@/lib/expiry'

// Sends the owner a Telegram summary of expired + soon-to-expire products.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!(await getApiUser(req))) return res.status(401).json({ error: "Ruxsat yo'q" })

  const ownerChat = process.env.TELEGRAM_OWNER_CHAT_ID
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!ownerChat || !token) return res.status(200).json({ ok: true, skipped: true })

  const svc = createServiceClient()
  const { data: products } = await svc.from('products').select('name, expiry_date').not('expiry_date', 'is', null)

  const expired: string[] = []
  const critical: string[] = []
  for (const p of products ?? []) {
    const { status, days } = expiryInfo(p.expiry_date)
    if (status === 'expired') expired.push(`• ${p.name} (${Math.abs(days!)} kun oldin)`)
    else if (status === 'critical') critical.push(`• ${p.name} (${days} kun qoldi)`)
  }

  if (expired.length === 0 && critical.length === 0) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ownerChat, text: '✅ Muddati tugayotgan mahsulot yo\'q. Hammasi joyida!' }),
    })
    return res.status(200).json({ ok: true, expired: 0, critical: 0 })
  }

  let msg = '📅 Yaroqlilik muddati hisoboti\n'
  if (expired.length) msg += `\n❌ Muddati tugagan (${expired.length}):\n${expired.join('\n')}\n`
  if (critical.length) msg += `\n⚠️ Tez tugaydi — 30 kun ichida (${critical.length}):\n${critical.join('\n')}\n`
  msg += '\n💡 Bularni chegirma yoki aksiya bilan soting.'

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: ownerChat, text: msg }),
  })

  return res.status(200).json({ ok: true, expired: expired.length, critical: critical.length })
}
