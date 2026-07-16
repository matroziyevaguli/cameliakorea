import { createClient } from './supabase/server'
import { type GetServerSidePropsContext } from 'next'

type GuardRole = 'admin' | 'seller'

export async function requireRole(ctx: GetServerSidePropsContext, role: GuardRole) {
  const supabase = createClient(ctx)
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return { redirect: { destination: '/login', permanent: false } }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', session.user.id)
    .single()

  if (!profile) {
    return { redirect: { destination: '/login', permanent: false } }
  }

  if (profile.role !== role) {
    const dest = profile.role === 'admin' ? '/admin' : '/seller'
    return { redirect: { destination: dest, permanent: false } }
  }

  return null
}
