import { createClient } from '@supabase/supabase-js'

// Service-role (server-only). Powerful; use in api routes / getServerSideProps only.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Anon/publishable key, no session. For PUBLIC data (the storefront) that reads the
// `v_shop` view. Uses the same NEXT_PUBLIC_* keys that already work everywhere.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
