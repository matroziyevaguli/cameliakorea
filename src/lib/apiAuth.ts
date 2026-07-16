import type { NextApiRequest } from 'next'
import { createServerClient } from '@supabase/ssr'

// Returns the logged-in user for an API route, or null. Uses getUser() which
// validates the token with the auth server (not just reads the cookie).
export async function getApiUser(req: NextApiRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => req.cookies[name], set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
