import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { useState } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ChevronLeft, Lock, CheckCircle, LogOut } from 'lucide-react'
import { MiniSpinner } from '@/components/Loader'

export default function SellerSettings({ sellerName }: { sellerName: string }) {
  const router = useRouter()
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setDone(false)
    if (pw1.length < 6) { setError("Parol kamida 6 ta belgidan iborat bo'lsin"); return }
    if (pw1 !== pw2) { setError("Parollar mos kelmadi"); return }
    setLoading(true)
    const supabase = createBrowser()
    const { error: err } = await supabase.auth.updateUser({ password: pw1 })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true); setPw1(''); setPw2('')
  }

  async function signOut() {
    const supabase = createBrowser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-gradient-to-br from-rose to-peach text-white px-5 pt-10 pb-14 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/4" />
        <Link href="/seller" className="relative flex items-center gap-1.5 text-white/80 hover:text-white mb-4 transition">
          <ChevronLeft className="w-5 h-5" /><span className="text-sm">Orqaga</span>
        </Link>
        <h1 className="font-display text-2xl font-bold relative">Sozlamalar</h1>
        <p className="text-white/80 text-sm relative mt-1">{sellerName}</p>
      </header>

      <main className="px-4 -mt-6 relative z-10 space-y-4 max-w-md mx-auto">
        {/* Change password */}
        <div className="bg-surface rounded-2xl shadow-card p-6">
          <h2 className="font-display font-bold text-ink text-lg mb-1 flex items-center gap-2">
            <Lock className="w-5 h-5 text-rose" /> Parolni o'zgartirish
          </h2>
          <p className="text-xs text-muted mb-5">Xavfsizlik uchun parolingizni istalgan vaqt yangilashingiz mumkin.</p>

          <form onSubmit={changePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Yangi parol</label>
              <input type="password" value={pw1} onChange={e => setPw1(e.target.value)} required
                placeholder="Kamida 6 ta belgi"
                className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Yangi parolni takrorlang</label>
              <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} required
                className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
            </div>

            {error && <div className="bg-red-50 text-danger text-sm text-center py-3 rounded-xl">{error}</div>}
            {done && (
              <div className="flex items-center justify-center gap-2 bg-green-50 text-success text-sm font-semibold py-3 rounded-xl">
                <CheckCircle className="w-4 h-4" /> Parol o'zgartirildi!
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-4 rounded-full shadow-rose active:scale-95 transition disabled:opacity-60">
              {loading && <MiniSpinner />}
              {loading ? 'Saqlanmoqda…' : 'Parolni saqlash'}
            </button>
          </form>
        </div>

        {/* Sign out */}
        <button onClick={signOut}
          className="w-full flex items-center justify-center gap-2 bg-surface text-danger font-semibold py-3.5 rounded-2xl shadow-card active:scale-95 transition">
          <LogOut className="w-4 h-4" /> Chiqish
        </button>
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'seller')
  if (guard) return guard

  const supabase = createClient(ctx)
  const { data: { session } } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', session!.user.id).single()

  return { props: { sellerName: profile?.full_name ?? '' } }
}
