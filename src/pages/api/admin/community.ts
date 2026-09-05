import type { NextApiRequest, NextApiResponse } from 'next'
import { createServiceClient } from '@/lib/supabase/api'
import { getApiUser } from '@/lib/apiAuth'

// Admin-only moderation for the Q&A board: answer / hide / unhide / delete.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: 'Kirish talab qilinadi' })
  const supabase = createServiceClient()
  const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', user.id).single()
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Ruxsat yo\'q' })

  const { id, action, answer } = req.body ?? {}
  if (!id || !action) return res.status(400).json({ error: "Ma'lumot yetarli emas" })

  try {
    if (action === 'answer') {
      const a = (answer ?? '').trim()
      if (!a) return res.status(400).json({ error: 'Javob bo\'sh' })
      const { error } = await supabase.from('community_questions')
        .update({ answer: a, status: 'answered', answered_at: new Date().toISOString() }).eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
    } else if (action === 'hide') {
      const { error } = await supabase.from('community_questions').update({ status: 'hidden' }).eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
    } else if (action === 'unhide') {
      // Back to answered if it has an answer, else pending.
      const { data: row } = await supabase.from('community_questions').select('answer').eq('id', id).single()
      const { error } = await supabase.from('community_questions')
        .update({ status: row?.answer ? 'answered' : 'pending' }).eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
    } else if (action === 'delete') {
      const { error } = await supabase.from('community_questions').delete().eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
    } else {
      return res.status(400).json({ error: 'Nomaʼlum amal' })
    }
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'Xatolik' })
  }
  return res.status(200).json({ ok: true })
}
