import { useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@/lib/supabase/browser'
import { GetServerSideProps } from 'next'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sellerEmail } from '@/lib/sellerEmail'
import { User, Lock, Sparkles } from 'lucide-react'
import { S } from '@/consts/strings'
import { SELLER_CONFIG } from '@/consts/sellerConfig'
import { MiniSpinner } from '@/components/Loader'

export default function Login() {
  const router = useRouter()
  // ?as=admin hints an email login; sellers type their name. We never list names (privacy).
  const isAdmin = router.query.as === 'admin'
  const [identity, setIdentity] = useState('')   // seller name, or an email (admin)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // A value with "@" is used as the email as-is (admin); otherwise it's a seller name we
    // deterministically turn into their login email — no name list is exposed anywhere.
    const value = identity.trim()
    const loginEmail = value.includes('@') ? value.toLowerCase() : sellerEmail(value)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email: loginEmail, password })

    if (authError) {
      // With a typed identity, a bad login can be a wrong name OR wrong password — say both.
      setError(/invalid login|credentials/i.test(authError.message)
        ? "Ism yoki parol noto'g'ri. Qayta urinib ko'ring."
        : S.loginNetworkError)
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
          {/* Identity — typed, not a list (so names aren't exposed) */}
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" />
            <input
              type="text"
              value={identity}
              onChange={e => setIdentity(e.target.value)}
              required
              autoComplete="username"
              autoCapitalize="none"
              placeholder={isAdmin ? 'Email' : 'Ismingiz'}
              className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-transparent bg-cream text-ink placeholder:text-muted font-sans text-base focus:outline-none focus:border-rose transition"
            />
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

  return { props: {} }
}
