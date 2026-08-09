import type { NextApiRequest, NextApiResponse } from 'next'
import { getCustomer } from '@/lib/customerAuth'

// Who is the current customer? (the session cookie is httpOnly, so the client asks the server.)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const customer = await getCustomer(req)
  return res.status(200).json({ customer })
}
