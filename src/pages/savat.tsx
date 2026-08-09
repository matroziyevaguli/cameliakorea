import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useCart } from '@/lib/cart'
import { formatUZS } from '@/lib/format'
import { CITIES } from '@/consts/geo'
import TelegramLogin from '@/components/TelegramLogin'
import { ShoppingBag, Minus, Plus, Trash2, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'

type Customer = { full_name: string | null; phone: string | null; email: string | null }

export default function Cart() {
  const router = useRouter()
  const { items, setQty, remove, clear, total, count } = useCart()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [form, setForm] = useState({ city: '', address: '', contact_name: '', contact_phone: '', email: '', note: '' })
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')

  async function loadMe() {
    const res = await fetch('/api/auth/me')
    const j = await res.json().catch(() => ({}))
    setCustomer(j.customer ?? null); setCheckedAuth(true)
    if (j.customer) setForm(f => ({
      ...f,
      contact_name: f.contact_name || j.customer.full_name || '',
      contact_phone: f.contact_phone || j.customer.phone || '',
      email: f.email || j.customer.email || '',
    }))
  }
  useEffect(() => { loadMe() }, [])

  async function place() {
    setError('')
    if (!form.city) { setError('Shaharni tanlang'); return }
    if (!form.address.trim() || !form.contact_name.trim() || !form.contact_phone.trim()) {
      setError("Ism, telefon va manzilni to'ldiring"); return
    }
    setPlacing(true)
    const res = await fetch('/api/orders/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map(i => ({ id: i.id, qty: i.qty })), ...form }),
    })
    const j = await res.json().catch(() => ({}))
    setPlacing(false)
    if (!res.ok) { setError(j.error ?? 'Xatolik'); return }
    clear()
    router.push(`/buyurtma/${j.orderId}`)
  }

  return (
    <>
      <Head><title>Savat — Camelia Korea</title></Head>
      <div className="min-h-screen bg-cream">
        <header className="sticky top-0 z-20 bg-cream/80 backdrop-blur border-b border-black/5">
          <div className="max-w-2xl mx-auto px-5 h-16 flex items-center gap-3">
            <Link href="/" className="text-muted hover:text-ink transition"><ArrowLeft className="w-5 h-5" /></Link>
            <h1 className="font-display font-bold text-ink text-lg flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-rose" /> Savat</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8">
          {count === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card p-8 text-center">
              <p className="text-muted">Savat bo'sh.</p>
              <Link href="/#mahsulotlar" className="inline-flex items-center gap-2 mt-4 text-rose font-semibold">
                Katalogni ko'rish <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Items */}
              <div className="bg-surface rounded-2xl shadow-card divide-y divide-black/5">
                {items.map(i => (
                  <div key={i.id} className="flex items-center gap-3 p-4">
                    <div className="w-14 h-14 rounded-xl bg-cream flex-shrink-0 overflow-hidden">
                      {i.image_url && <img src={i.image_url} alt={i.name} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink text-sm line-clamp-2">{i.name}</p>
                      <p className="text-sm font-display font-bold text-ink mt-0.5">{formatUZS(i.price)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setQty(i.id, i.qty - 1)} className="w-8 h-8 rounded-full bg-cream grid place-items-center active:scale-90 transition"><Minus className="w-4 h-4" /></button>
                      <span className="w-7 text-center font-semibold">{i.qty}</span>
                      <button onClick={() => setQty(i.id, i.qty + 1)} className="w-8 h-8 rounded-full bg-gradient-to-br from-rose to-peach text-white grid place-items-center active:scale-90 transition"><Plus className="w-4 h-4" /></button>
                      <button onClick={() => remove(i.id)} aria-label="O'chirish" className="ml-1 text-muted hover:text-danger transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between p-4">
                  <span className="text-muted">Jami</span>
                  <span className="font-display font-bold text-ink text-lg">{formatUZS(total)}</span>
                </div>
              </div>

              {/* Auth + checkout */}
              {!checkedAuth ? (
                <div className="bg-surface rounded-2xl shadow-card p-6 flex items-center gap-2 text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda…</div>
              ) : !customer ? (
                <div className="bg-surface rounded-2xl shadow-card p-6 text-center">
                  <p className="font-display font-bold text-ink mb-1">Buyurtma berish uchun kiring</p>
                  <p className="text-sm text-muted mb-4">Telegram orqali bir bosishda.</p>
                  <div className="flex justify-center"><TelegramLogin onSuccess={loadMe} /></div>
                </div>
              ) : (
                <div className="bg-surface rounded-2xl shadow-card p-6 space-y-4">
                  <h2 className="font-display font-bold text-ink">Yetkazish ma'lumotlari</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">Shahar</label>
                      <select value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                        className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition">
                        <option value="">— tanlang —</option>
                        {CITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">Telefon</label>
                      <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                        placeholder="+998 ..." className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">Ism</label>
                      <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                        className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">Email (ixtiyoriy)</label>
                      <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">Manzil</label>
                    <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2}
                      placeholder="Tuman, ko'cha, uy…" className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition resize-none" />
                  </div>
                  <p className="text-xs text-muted">To'lov — buyurtmadan so'ng ko'rsatilgan kartaga o'tkazma. Yetkazish haqi alohida.</p>
                  {error && <p className="text-danger text-sm">{error}</p>}
                  <button onClick={place} disabled={placing}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-4 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50">
                    {placing ? <><Loader2 className="w-5 h-5 animate-spin" /> Yuborilmoqda…</> : <>Buyurtma berish <ArrowRight className="w-5 h-5" /></>}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
