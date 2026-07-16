import { useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@/lib/supabase/browser'
import { GetServerSideProps } from 'next'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { User, Lock, Sparkles } from 'lucide-react'
import { S } from '@/consts/strings'
import { MiniSpinner } from '@/components/Loader'

// Fixed set of users — each label maps to the exact auth email.
const USERS = [
  { label: 'Admin (Guli)', email: 'matroziyevaguli@gmail.com', role: 'admin' as const },
  { label: 'Gulshan',      email: 'gulshan@sellers.local',     role: 'seller' as const },
  { label: 'Adolat',       email: 'adolat@sellers.local',      role: 'seller' as const },
  { label: 'Saida',        email: 'saida@sellers.local',       role: 'seller' as const },
]

export default function Login() {
  const router = useRouter()
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
      setError(S.loginError)
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
