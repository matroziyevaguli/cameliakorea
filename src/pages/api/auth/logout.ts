import type { NextApiRequest, NextApiResponse } from 'next'
import { clearSessionCookie } from '@/lib/customerAuth'

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  clearSessionCookie(res)
  return res.status(200).json({ ok: true })
}
