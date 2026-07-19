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

// A Supabase client that carries the caller's session (RLS + auth.uid() apply). Use when a
// query/RPC must run AS the logged-in user — e.g. an RPC that checks is_admin() internally.
export function createUserClient(req: NextApiRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => req.cookies[name], set() {}, remove() {} } }
  )
}
