import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/api'
import { notifyOwner } from '@/lib/telegram'
import { TOPIC_LABEL } from '@/consts/community'

// Anonymous asking is allowed, so guard spam with a per-IP rate limit: at most N questions per
// window. We store only a salted HASH of the IP (never the raw IP) for privacy.
const WINDOW_MS = 10 * 60 * 1000   // 10 minutes
const MAX_PER_WINDOW = 5

function ipHash(req: NextApiRequest): string {
  const fwd = (req.headers['x-forwarded-for'] as string) || ''
  const ip = fwd.split(',')[0].trim() || req.socket.remoteAddress || 'unknown'
  return crypto.createHash('sha256').update(ip + (process.env.SUPABASE_SERVICE_ROLE_KEY || '')).digest('hex')
}

// Public: submit a question → stored as `pending` (not visible until answered). Anonymous-friendly.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, question, topic } = req.body ?? {}
  const q = (question ?? '').trim()
  if (q.length < 5) return res.status(400).json({ error: 'Savol juda qisqa (kamida 5 ta belgi).' })
  if (q.length > 1000) return res.status(400).json({ error: 'Savol juda uzun (1000 belgigacha).' })

  const supabase = createServiceClient()
  const hash = ipHash(req)

  // Rate limit: count this IP's questions in the window. Best-effort — if the ip_hash column
  // isn't present yet, skip the limit rather than block asking.
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { count, error: countErr } = await supabase.from('community_questions')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', hash).gte('created_at', since)
  if (!countErr && (count ?? 0) >= MAX_PER_WINDOW) {
    return res.status(429).json({ error: 'Juda ko\'p savol yubordingiz. Birozdan so\'ng qayta urinib ko\'ring.' })
  }

  const base = {
    name: (name ?? '').trim() || null,
    question: q,
    topic: TOPIC_LABEL[topic] ? topic : null,   // only accept known slugs
    status: 'pending' as const,
  }
  // Insert with ip_hash; if that column doesn't exist yet, retry without it so asking still works.
  let { error } = await supabase.from('community_questions').insert({ ...base, ip_hash: hash })
  if (error && /ip_hash/i.test(error.message)) {
    ;({ error } = await supabase.from('community_questions').insert(base))
  }
  if (error) return res.status(500).json({ error: error.message })

  notifyOwner(`❓ Yangi savol (Savol-javob):\n${q.slice(0, 300)}\n\n→ /admin/community`)
  return res.status(200).json({ ok: true })
}
