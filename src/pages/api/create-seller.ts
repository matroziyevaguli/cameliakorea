import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiUser } from '@/lib/apiAuth'
import { createServiceClient } from '@/lib/supabase/api'
import { sellerEmail } from '@/lib/sellerEmail'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await getApiUser(req)
  if (!user) return res.status(401).json({ error: "Ruxsat yo'q" })

  const svc = createServiceClient()

  // Only an admin may create sellers
  const { data: me } = await svc.from('profiles').select('role').eq('user_id', user.id).single()
  if (me?.role !== 'admin') return res.status(403).json({ error: 'Faqat admin' })

  const { full_name, password, commission_rate, opening_balance } = req.body as {
    full_name?: string; password?: string; commission_rate?: number; opening_balance?: number
  }
  if (!full_name?.trim()) return res.status(400).json({ error: 'Ism kiriting' })
  if (!password || password.length < 6) return res.status(400).json({ error: "Parol kamida 6 ta belgi" })

  const email = sellerEmail(full_name)

  // 1) create the login account
  const { data: created, error: cErr } = await svc.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (cErr || !created?.user) {
    return res.status(400).json({ error: cErr?.message ?? 'Akkaunt yaratilmadi' })
  }

  // 2) create the profile linked to it
  const { error: pErr } = await svc.from('profiles').insert({
    full_name: full_name.trim(),
    role: 'seller',
    commission_rate: commission_rate ?? 0.40,
    opening_balance: opening_balance ?? 0,
    active: true,
    user_id: created.user.id,
  })
  if (pErr) {
    // roll back the auth account so we don't leave an orphan
    await svc.auth.admin.deleteUser(created.user.id)
    return res.status(400).json({ error: pErr.message })
  }

  return res.status(200).json({ ok: true, email })
}
