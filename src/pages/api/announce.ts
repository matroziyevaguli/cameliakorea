import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser } from '@/lib/apiAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Require a logged-in user (admin or seller). Blocks anonymous channel spam.
  if (!(await getApiUser(req))) return res.status(401).json({ error: "Ruxsat yo'q — tizimga kiring" })

  const { image_url, caption, link } = req.body as {
    image_url?: string
    caption?: string
    link?: string
  }

  if (!image_url || !caption) {
    return res.status(400).json({ error: 'image_url and caption are required' })
  }

  const token = process.env.TELEGRAM_BOT_TOKEN
  const channel = process.env.TELEGRAM_CHANNEL

  if (!token || !channel) {
    // Name the missing var(s) so it's obvious what this deployment can't see (no values leaked).
    const missing = [!token && 'TELEGRAM_BOT_TOKEN', !channel && 'TELEGRAM_CHANNEL'].filter(Boolean).join(', ')
    return res.status(500).json({ error: `Telegram credentials not configured (missing: ${missing})` })
  }

  const body: Record<string, unknown> = {
    chat_id: channel,
    photo: image_url,
    caption,
  }

  if (link) {
    body.reply_markup = {
      inline_keyboard: [[{ text: "▶️ Videoni ko'rish", url: link }]],
    }
  }

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const tgData = await tgRes.json()

  if (!tgData.ok) {
    return res.status(502).json({ error: tgData.description ?? 'Telegram error' })
  }

  return res.status(200).json({ ok: true })
}
