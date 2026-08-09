// Customer auth for the storefront — decoupled from the admin/seller Supabase Auth.
// Telegram Login Widget → we verify the hash with the bot token, upsert a `customers` row,
// and hand back an opaque session token stored in an httpOnly cookie. Order API routes call
// `getCustomer(req)` to resolve the current customer via the service role.
import crypto from 'crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { createServiceClient } from '@/lib/supabase/api'

export const CUSTOMER_COOKIE = 'camelia_customer'

export type TelegramAuth = {
  id: number; first_name?: string; last_name?: string; username?: string
  photo_url?: string; auth_date: number; hash: string
}

// Verify the Telegram Login Widget payload (https://core.telegram.org/widgets/login#checking-authorization).
export function verifyTelegramAuth(data: TelegramAuth, botToken: string): boolean {
  const { hash, ...fields } = data
  const checkString = Object.keys(fields)
    .sort()
    .map(k => `${k}=${(fields as any)[k]}`)
    .join('\n')
  const secret = crypto.createHash('sha256').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex')
  if (hmac !== hash) return false
  // Reject stale logins (> 24h).
  if (Date.now() / 1000 - data.auth_date > 86400) return false
  return true
}

export function setSessionCookie(res: NextApiResponse, token: string) {
  const parts = [
    `${CUSTOMER_COOKIE}=${token}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${60 * 60 * 24 * 180}`,
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export function clearSessionCookie(res: NextApiResponse) {
  res.setHeader('Set-Cookie', `${CUSTOMER_COOKIE}=; Path=/; HttpOnly; Max-Age=0`)
}

export type Customer = {
  id: string; telegram_id: string | null; full_name: string | null
  phone: string | null; email: string | null
}

// Resolve the logged-in customer from the session cookie (server-side, service role).
export async function getCustomer(req: NextApiRequest): Promise<Customer | null> {
  const token = req.cookies?.[CUSTOMER_COOKIE]
  if (!token) return null
  const supabase = createServiceClient()
  const { data } = await supabase.from('customers')
    .select('id, telegram_id, full_name, phone, email')
    .eq('session_token', token).single()
  return (data as Customer) ?? null
}

// Read the raw cookie value inside getServerSideProps (where we only have req.cookies).
export function customerTokenFromCookies(cookies: Partial<Record<string, string>>): string | undefined {
  return cookies?.[CUSTOMER_COOKIE]
}
