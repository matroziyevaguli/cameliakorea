import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/api'
import { verifyTelegramAuth, setSessionCookie, type TelegramAuth } from '@/lib/customerAuth'

// Telegram Login Widget callback. Verifies the signed payload, upserts the customer, and issues
// a session cookie. The widget posts the user object; we trust it only after the hash checks out.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return res.status(500).json({ error: 'Bot sozlanmagan' })

  const data = req.body as TelegramAuth
  if (!data?.id || !data?.hash) return res.status(400).json({ error: "Ma'lumot yetarli emas" })
  if (!verifyTelegramAuth(data, token)) return res.status(401).json({ error: 'Tekshiruvdan o\'tmadi' })

  const supabase = createServiceClient()
  const telegram_id = String(data.id)
  const full_name = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username || null
  const session_token = crypto.randomUUID()

  const { data: existing } = await supabase.from('customers').select('id').eq('telegram_id', telegram_id).single()
  if (existing) {
    await supabase.from('customers').update({ session_token, full_name }).eq('id', existing.id)
  } else {
    await supabase.from('customers').insert({ telegram_id, full_name, session_token })
  }

  setSessionCookie(res, session_token)
  return res.status(200).json({ ok: true, customer: { telegram_id, full_name } })
}
