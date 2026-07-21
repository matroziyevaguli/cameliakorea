import { useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@/lib/supabase/browser'
import { GetServerSideProps } from 'next'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createPublicClient } from '@/lib/supabase/api'
import { sellerEmail } from '@/lib/sellerEmail'
import { User, Lock, Sparkles } from 'lucide-react'
import { S } from '@/consts/strings'
import { SELLER_CONFIG } from '@/consts/sellerConfig'
import { MiniSpinner } from '@/components/Loader'

const ADMIN = { label: 'Admin (Guli)', email: 'matroziyevaguli@gmail.com', role: 'admin' as const }

export default function Login({ sellerNames }: { sellerNames: string[] }) {
  const router = useRouter()
  // Build the user list: the admin + every active seller (loaded from the DB).
  const USERS = [
    ADMIN,
    ...sellerNames.map(n => ({ label: n, email: sellerEmail(n), role: 'seller' as const })),
  ]
  // ?as=admin / ?as=seller from the landing login menu filters who's shown.
  const as = router.query.as
  const users = as === 'admin' || as === 'seller' ? USERS.filter(u => u.role === as) : USERS
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      // The name comes from a fixed dropdown, so it is always a real account —
      // "invalid credentials" can only mean the password (G8: say which field).
      setError(/invalid login|credentials/i.test(authError.message) ? S.loginWrongPassword : S.loginNetworkError)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .single()

    if (profile?.role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/seller')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose to-peach flex items-center justify-center p-5">
      <div className="w-full max-w-sm bg-surface rounded-3xl shadow-rose p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-rose to-peach mb-4 shadow-rose">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">{S.welcome}</h1>
          <p className="text-muted text-sm mt-1">Camelia Boshqaruv</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User select */}
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
            <select
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className={`w-full pl-12 pr-4 py-4 rounded-xl border-2 border-transparent bg-cream font-sans text-base focus:outline-none focus:border-rose transition appearance-none ${email ? 'text-ink' : 'text-muted'}`}
            >
              <option value="" disabled>Ismingizni tanlang</option>
              {users.map(u => (
                <option key={u.email} value={u.email} className="text-ink">{u.label}</option>
              ))}
            </select>
          </div>

          {/* Password field */}
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder={S.passPlaceholder}
              className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-transparent bg-cream text-ink placeholder:text-muted font-sans text-base focus:outline-none focus:border-rose transition"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-danger text-sm text-center py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold text-lg py-4 rounded-full shadow-rose active:scale-95 transition disabled:opacity-60 mt-2"
          >
            {loading && <MiniSpinner />}
            {loading ? S.loggingIn : S.loginBtn}
          </button>

          {/* One recovery path (G8) — there is no self-serve reset, so send her to the admin. */}
          <a href={SELLER_CONFIG.adminTelegramUrl} target="_blank" rel="noopener noreferrer"
            className="block text-center text-sm text-muted hover:text-rose transition pt-1">
            {S.forgotPassword}
          </a>
        </form>
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = createServerClient(ctx)
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single()

    if (profile?.role === 'admin') return { redirect: { destination: '/admin', permanent: false } }
    if (profile?.role === 'seller') return { redirect: { destination: '/seller', permanent: false } }
  }

  // Load active seller names for the dropdown (public view, anon key).
  let sellerNames: string[] = []
  try {
    const pub = createPublicClient()
    const { data } = await pub.from('v_login_sellers').select('full_name')
    if (data) sellerNames = data.map((r: any) => r.full_name)
  } catch { /* view may not exist yet */ }

  // Fallback so login always works even before the v_login_sellers SQL is run.
  if (sellerNames.length === 0) sellerNames = ['GULSHAN', 'ADOLAT', 'SAIDA']

  return { props: { sellerNames } }
}
