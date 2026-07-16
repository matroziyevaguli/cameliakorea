import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { useState } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import { useRouter } from 'next/router'
import AdminNav from '@/components/AdminNav'
import { Pencil, X, CheckCircle, ChevronRight } from 'lucide-react'

type Seller = { id: string; full_name: string; commission_rate: number; opening_balance: number; active: boolean }

export default function Sellers({ sellers }: { sellers: Seller[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<{ commission_rate: string; active: boolean }>({ commission_rate: '', active: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function openEdit(s: Seller) { setEditing(s.id); setForm({ commission_rate: String(s.commission_rate), active: s.active }); setError('') }

  async function save(id: string) {
    setLoading(true); setError('')
    const supabase = createBrowser()
    const { error: err } = await supabase.from('profiles').update({ commission_rate: Number(form.commission_rate), active: form.active }).eq('id', id)
    setLoading(false)
    if (err) { setError(err.message); return }
    setEditing(null); router.replace(router.asPath)
  }

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-6 max-w-3xl mx-auto">
        <h2 className="font-display font-bold text-ink text-2xl mb-6">Sotuvchilar</h2>

        <div className="space-y-3">
          {sellers.map(s => (
            <div key={s.id} className="bg-surface rounded-2xl shadow-card p-5 hover:shadow-rose transition">
              {editing === s.id ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-display font-bold text-ink text-lg">{s.full_name}</p>
                    <button onClick={() => setEditing(null)} className="text-muted hover:text-ink transition"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="flex gap-6 items-end flex-wrap">
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">Komissiya (0–1)</label>
                      <input type="number" step="0.01" min={0} max={1} value={form.commission_rate}
                        onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
                        className="bg-cream text-ink rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition w-28" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                        className="w-5 h-5 rounded accent-rose" />
                      <span className="text-sm font-medium text-ink">Faol</span>
                    </label>
                  </div>
                  {error && <p className="text-danger text-sm mt-2">{error}</p>}
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => save(s.id)} disabled={loading}
                      className="bg-gradient-to-br from-rose to-peach text-white font-semibold px-5 py-2 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50 text-sm flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> {loading ? 'Saqlanmoqda…' : 'Saqlash'}
                    </button>
                    <button onClick={() => setEditing(null)} className="text-muted hover:text-ink text-sm px-4 py-2 transition">Bekor qilish</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => router.push(`/admin/sellers/${s.id}`)}
                  className="flex items-center justify-between cursor-pointer -m-5 p-5 rounded-2xl"
                >
                  <div>
                    <p className="font-display font-bold text-ink text-base">{s.full_name}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-muted bg-cream px-2.5 py-1 rounded-full">
                        Komissiya: {(s.commission_rate * 100).toFixed(0)}%
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.active ? 'bg-green-100 text-success' : 'bg-red-100 text-danger'}`}>
                        {s.active ? 'Faol' : 'Nofaol'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(s) }}
                      title="Tahrirlash"
                      className="text-rose hover:text-roseDark transition p-2"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-muted" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'admin')
  if (guard) return guard
  const supabase = createClient(ctx)
  const { data: sellers } = await supabase.from('profiles').select('id, full_name, commission_rate, opening_balance, active').eq('role', 'seller').order('full_name')
  return { props: { sellers: sellers ?? [] } }
}
