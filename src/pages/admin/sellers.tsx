import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { useState } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import { useRouter } from 'next/router'
import AdminNav from '@/components/AdminNav'
import { formatUZS } from '@/lib/format'
import { Pencil, X, CheckCircle, ChevronRight, UserPlus } from 'lucide-react'
import { MiniSpinner } from '@/components/Loader'

type Seller = { id: string; full_name: string; commission_rate: number; opening_balance: number; active: boolean }

type EditForm = { full_name: string; commissionPct: string; opening_balance: string; active: boolean }
type AddForm = { full_name: string; password: string; commissionPct: string; opening_balance: string }

export default function Sellers({ sellers }: { sellers: Seller[] }) {
  const router = useRouter()

  // Edit state
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<EditForm>({ full_name: '', commissionPct: '', opening_balance: '', active: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Add state
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<AddForm>({ full_name: '', password: '', commissionPct: '40', opening_balance: '0' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [addOk, setAddOk] = useState('')

  function openEdit(s: Seller) {
    setEditing(s.id)
    setForm({ full_name: s.full_name, commissionPct: String(Math.round(s.commission_rate * 100)), opening_balance: String(s.opening_balance), active: s.active })
    setError('')
  }

  async function save(id: string) {
    const pct = Number(form.commissionPct)
    if (!form.full_name.trim()) { setError('Ism kiriting'); return }
    if (pct < 0 || pct > 100) { setError('Komissiya 0–100% oralig\'ida'); return }
    setLoading(true); setError('')
    const supabase = createBrowser()
    const { error: err } = await supabase.from('profiles').update({
      full_name: form.full_name.trim(),
      commission_rate: pct / 100,
      opening_balance: Number(form.opening_balance) || 0,
      active: form.active,
    }).eq('id', id)
    setLoading(false)
    if (err) { setError(err.message); return }
    setEditing(null); router.replace(router.asPath)
  }

  async function addSeller(e: React.FormEvent) {
    e.preventDefault()
    setAddError(''); setAddOk('')
    const pct = Number(addForm.commissionPct)
    if (pct < 0 || pct > 100) { setAddError('Komissiya 0–100% oralig\'ida'); return }
    setAdding(true)
    const res = await fetch('/api/create-seller', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: addForm.full_name,
        password: addForm.password,
        commission_rate: pct / 100,
        opening_balance: Number(addForm.opening_balance) || 0,
      }),
    })
    const json = await res.json()
    setAdding(false)
    if (!res.ok) { setAddError(json.error ?? 'Xatolik'); return }
    setAddOk(`Qo'shildi! Login: ${json.email}`)
    setAddForm({ full_name: '', password: '', commissionPct: '40', opening_balance: '0' })
    router.replace(router.asPath)
  }

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold text-ink text-2xl">Sotuvchilar</h2>
          {!showAdd && (
            <button onClick={() => { setShowAdd(true); setAddOk(''); setAddError('') }}
              className="flex items-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-semibold px-5 py-2.5 rounded-full shadow-rose active:scale-95 transition text-sm">
              <UserPlus className="w-4 h-4" /> Yangi sotuvchi
            </button>
          )}
        </div>

        {/* Add seller form */}
        {showAdd && (
          <div className="bg-surface rounded-2xl shadow-card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-ink text-lg">Yangi sotuvchi qo'shish</h3>
              <button onClick={() => setShowAdd(false)} className="text-muted hover:text-ink transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={addSeller} className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Ism</label>
                <input value={addForm.full_name} onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} required
                  placeholder="Masalan: Malika"
                  className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Parol (login uchun)</label>
                <input value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} required minLength={6}
                  placeholder="Kamida 6 ta belgi"
                  className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Komissiya (%)</label>
                <input type="number" min={0} max={100} value={addForm.commissionPct} onChange={e => setAddForm(f => ({ ...f, commissionPct: e.target.value }))}
                  className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Boshlang'ich qarz (so'm)</label>
                <input type="number" min={0} value={addForm.opening_balance} onChange={e => setAddForm(f => ({ ...f, opening_balance: e.target.value }))}
                  className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
              </div>
              {addError && <p className="text-danger text-sm sm:col-span-2">{addError}</p>}
              {addOk && <p className="text-success text-sm font-semibold sm:col-span-2">{addOk}</p>}
              <div className="sm:col-span-2 flex gap-3">
                <button type="submit" disabled={adding}
                  className="flex items-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-semibold px-6 py-2.5 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50 text-sm">
                  {adding && <MiniSpinner />} {adding ? 'Yaratilmoqda…' : "Sotuvchi yaratish"}
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="text-muted hover:text-ink text-sm px-4 transition">Bekor qilish</button>
              </div>
            </form>
            <p className="text-xs text-muted mt-3">Login: ismdan avtomatik yaratiladi (masalan «Malika» → malika@sellers.local). Sotuvchi parolni keyin Sozlamalarda o'zgartira oladi.</p>
          </div>
        )}

        <div className="space-y-3">
          {sellers.map(s => (
            <div key={s.id} className="bg-surface rounded-2xl shadow-card p-5 hover:shadow-rose transition">
              {editing === s.id ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-display font-bold text-ink text-lg">Tahrirlash</p>
                    <button onClick={() => setEditing(null)} className="text-muted hover:text-ink transition"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">Ism</label>
                      <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                        className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">Komissiya (%)</label>
                      <input type="number" min={0} max={100} value={form.commissionPct}
                        onChange={e => setForm(f => ({ ...f, commissionPct: e.target.value }))}
                        className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">Boshlang'ich qarz (so'm)</label>
                      <input type="number" value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
                        className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none self-end pb-1">
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
                <div onClick={() => router.push(`/admin/sellers/${s.id}`)}
                  className="flex items-center justify-between cursor-pointer -m-5 p-5 rounded-2xl">
                  <div>
                    <p className="font-display font-bold text-ink text-base">{s.full_name}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs text-muted bg-cream px-2.5 py-1 rounded-full">Komissiya: {(s.commission_rate * 100).toFixed(0)}%</span>
                      {s.opening_balance > 0 && <span className="text-xs text-warning bg-orange-50 px-2.5 py-1 rounded-full">Boshl. qarz: {formatUZS(s.opening_balance)}</span>}
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.active ? 'bg-green-100 text-success' : 'bg-red-100 text-danger'}`}>{s.active ? 'Faol' : 'Nofaol'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(s) }} title="Tahrirlash" className="text-rose hover:text-roseDark transition p-2">
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
