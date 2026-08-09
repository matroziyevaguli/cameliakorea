import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { useState } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import { useRouter } from 'next/router'
import AdminNav from '@/components/AdminNav'
import { formatUZS } from '@/lib/format'
import { Pencil, X, CheckCircle, ChevronRight, UserPlus, CreditCard } from 'lucide-react'
import { MiniSpinner } from '@/components/Loader'
import { CITIES, CITY_LABEL } from '@/consts/geo'
import CardNumberInput from '@/components/CardNumberInput'
import { cardDigits, isValidCard, maskCard, detectBrand } from '@/lib/card'

type Seller = {
  id: string; full_name: string; commission_rate: number; opening_balance: number; active: boolean
  city: string | null; card_number: string | null; card_holder: string | null
}

type EditForm = { full_name: string; commissionPct: string; opening_balance: string; active: boolean; city: string; card_number: string; card_holder: string }
type AddForm = { full_name: string; password: string; commissionPct: string; opening_balance: string }

export default function Sellers({ sellers: initialSellers }: { sellers: Seller[] }) {
  const router = useRouter()
  // G2 — update in place, reconcile in the background.
  const [sellers, setSellers] = useState<Seller[]>(initialSellers)

  async function reconcile() {
    const supabase = createBrowser()
    const { data } = await supabase.from('profiles')
      .select('id, full_name, commission_rate, opening_balance, active, city, card_number, card_holder')
      .eq('role', 'seller').order('full_name')
    if (data) setSellers(data as Seller[])
  }

  // Edit state
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<EditForm>({ full_name: '', commissionPct: '', opening_balance: '', active: true, city: '', card_number: '', card_holder: '' })
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
    setForm({
      full_name: s.full_name, commissionPct: String(Math.round(s.commission_rate * 100)),
      opening_balance: String(s.opening_balance), active: s.active,
      city: s.city ?? '', card_number: s.card_number ?? '', card_holder: s.card_holder ?? '',
    })
    setError('')
  }

  async function save(id: string) {
    const pct = Number(form.commissionPct)
    if (!form.full_name.trim()) { setError('Ism kiriting'); return }
    if (pct < 0 || pct > 100) { setError('Komissiya 0–100% oralig\'ida'); return }
    if (cardDigits(form.card_number).length > 0 && !isValidCard(form.card_number)) {
      setError('Karta raqami to\'liq emas (16 ta raqam)'); return
    }
    setLoading(true); setError('')
    const supabase = createBrowser()
    const patch = {
      full_name: form.full_name.trim(),
      commission_rate: pct / 100,
      opening_balance: Number(form.opening_balance) || 0,
      active: form.active,
      city: form.city || null,
      card_number: form.card_number.trim() || null,
      card_holder: form.card_holder.trim() || null,
    }
    const { error: err } = await supabase.from('profiles').update(patch).eq('id', id)
    setLoading(false)
    if (err) { setError(err.message); return }
    // Optimistic
    setSellers(list => list.map(s => s.id === id ? { ...s, ...patch } : s))
    setEditing(null)
    reconcile()
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
    reconcile()
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
              <button aria-label="Yopish" onClick={() => setShowAdd(false)} className="text-muted hover:text-ink transition"><X className="w-5 h-5" /></button>
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
                    <button aria-label="Yopish" onClick={() => setEditing(null)} className="text-muted hover:text-ink transition"><X className="w-5 h-5" /></button>
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

                    {/* Payout card + default city — shown to customers who order for this seller's city */}
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">Viloyat (buyurtma uchun)</label>
                      <select value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                        className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition">
                        <option value="">— tanlanmagan —</option>
                        {CITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">Karta raqami</label>
                      <CardNumberInput value={form.card_number} onChange={v => setForm(f => ({ ...f, card_number: v }))} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-muted mb-1">Karta egasi (ism)</label>
                      <input value={form.card_holder} onChange={e => setForm(f => ({ ...f, card_holder: e.target.value }))}
                        placeholder="Masalan: GULSHANOY MATNAZAROVA"
                        className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
                    </div>
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
                      {s.city && <span className="text-xs text-sky bg-sky/10 px-2.5 py-1 rounded-full">{CITY_LABEL[s.city] ?? s.city}</span>}
                      <span className={`text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${s.card_number ? 'bg-lavender/15 text-lavender' : 'bg-orange-50 text-warning'}`}>
                        <CreditCard className="w-3 h-3" /> {s.card_number ? `${detectBrand(s.card_number)?.label ?? 'Karta'} ${maskCard(s.card_number)}` : 'Karta yo\'q'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button aria-label="Tahrirlash" onClick={(e) => { e.stopPropagation(); openEdit(s) }} title="Tahrirlash" className="text-rose hover:text-roseDark transition p-2">
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
  const { data: sellers } = await supabase.from('profiles').select('id, full_name, commission_rate, opening_balance, active, city, card_number, card_holder').eq('role', 'seller').order('full_name')
  return { props: { sellers: sellers ?? [] } }
}
