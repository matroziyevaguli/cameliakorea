import type { NextApiRequest, NextApiResponse } from 'next'
import { createServiceClient } from '@/lib/supabase/api'
import { notifyOwner } from '@/lib/telegram'
import { TOPIC_LABEL } from '@/consts/community'

// Public: submit a question → stored as `pending` (not visible until answered). Anonymous-friendly.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, question, topic } = req.body ?? {}
  const q = (question ?? '').trim()
  if (q.length < 5) return res.status(400).json({ error: 'Savol juda qisqa (kamida 5 ta belgi).' })
  if (q.length > 1000) return res.status(400).json({ error: 'Savol juda uzun (1000 belgigacha).' })

  const supabase = createServiceClient()
  const { error } = await supabase.from('community_questions').insert({
    name: (name ?? '').trim() || null,
    question: q,
    topic: TOPIC_LABEL[topic] ? topic : null,   // only accept known slugs
    status: 'pending',
  })
  if (error) return res.status(500).json({ error: error.message })

  notifyOwner(`❓ Yangi savol (Savol-javob):\n${q.slice(0, 300)}\n\n→ /admin/community`)
  return res.status(200).json({ ok: true })
}
