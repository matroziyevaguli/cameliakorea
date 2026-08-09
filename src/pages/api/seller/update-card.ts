import type { NextApiRequest, NextApiResponse } from 'next'
import { createServiceClient } from '@/lib/supabase/api'
import { getApiUser } from '@/lib/apiAuth'

// A seller edits ONLY their own payout card + city. Goes through the service role but is
// tightly scoped: it updates just these three columns on the caller's own row, so a seller
// can never touch commission_rate, balance, active, etc.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: 'Kirish talab qilinadi' })

  const supabase = createServiceClient()
  const { data: profile } = await supabase.from('profiles').select('id, role').eq('user_id', user.id).single()
  if (!profile || profile.role !== 'seller') return res.status(403).json({ error: 'Ruxsat yo\'q' })

  const { card_number, card_holder, city } = req.body ?? {}
  const { error } = await supabase.from('profiles').update({
    card_number: (card_number ?? '').trim() || null,
    card_holder: (card_holder ?? '').trim() || null,
    city: city || null,
  }).eq('id', profile.id)   // own row only

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
