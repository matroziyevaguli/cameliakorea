import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useCart, type CartItem } from '@/lib/cart'
import { formatUZS } from '@/lib/format'
import { CITIES } from '@/consts/geo'
import TelegramLogin from '@/components/TelegramLogin'
import { useT } from '@/i18n'
import LangSwitcher from '@/components/LangSwitcher'
import { ShoppingBag, Minus, Plus, Trash2, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'

type Customer = { full_name: string | null; phone: string | null; email: string | null }

export default function Cart() {
  const t = useT()
  const router = useRouter()
  const { items, setQty, remove, clear, total, count } = useCart()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [form, setForm] = useState({ city: '', address: '', contact_name: '', contact_phone: '', email: '', note: '' })
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<CartItem | null>(null)

  // Decrement, but if it would empty the line, ask first.
  function decrement(i: CartItem) {
    if (i.qty <= 1) setConfirmRemove(i)
    else setQty(i.id, i.qty - 1)
  }

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
    if (!form.city) { setError(t('checkout.errRegion')); return }
    if (!form.address.trim() || !form.contact_name.trim() || !form.contact_phone.trim()) {
      setError(t('checkout.errContact')); return
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
      <Head><title>{t('cart.title')} — Camelia Korea</title></Head>
      <div className="min-h-screen bg-cream">
        <header className="sticky top-0 z-20 bg-cream/80 backdrop-blur border-b border-black/5">
          <div className="max-w-2xl mx-auto px-5 h-16 flex items-center gap-3">
            <Link href="/" className="text-muted hover:text-ink transition"><ArrowLeft className="w-5 h-5" /></Link>
            <h1 className="font-display font-bold text-ink text-lg flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-rose" /> {t('cart.title')}</h1>
            <div className="ml-auto"><LangSwitcher /></div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8">
          {count === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card p-8 text-center">
              <p className="text-muted">{t('cart.empty')}</p>
              <Link href="/#mahsulotlar" className="inline-flex items-center gap-2 mt-4 text-rose font-semibold">
                {t('home.viewCatalog')} <ArrowRight className="w-4 h-4" />
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
                      <button onClick={() => decrement(i)} className="w-8 h-8 rounded-full bg-cream grid place-items-center active:scale-90 transition"><Minus className="w-4 h-4" /></button>
                      <span className="w-7 text-center font-semibold">{i.qty}</span>
                      <button onClick={() => setQty(i.id, i.qty + 1)} className="w-8 h-8 rounded-full bg-gradient-to-br from-rose to-peach text-white grid place-items-center active:scale-90 transition"><Plus className="w-4 h-4" /></button>
                      <button onClick={() => setConfirmRemove(i)} aria-label={t('common.remove')} className="ml-1 text-muted hover:text-danger transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between p-4">
                  <span className="text-muted">{t('cart.total')}</span>
                  <span className="font-display font-bold text-ink text-lg">{formatUZS(total)}</span>
                </div>
              </div>

              {/* Auth + checkout */}
              {!checkedAuth ? (
                <div className="bg-surface rounded-2xl shadow-card p-6 flex items-center gap-2 text-muted"><Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}</div>
              ) : !customer ? (
                <div className="bg-surface rounded-2xl shadow-card p-6 text-center">
                  <p className="font-display font-bold text-ink mb-1">{t('cart.loginTitle')}</p>
                  <p className="text-sm text-muted mb-4">{t('cart.loginSub')}</p>
                  <div className="flex justify-center"><TelegramLogin onSuccess={loadMe} /></div>
                </div>
              ) : (
                <div className="bg-surface rounded-2xl shadow-card p-6 space-y-4">
                  <h2 className="font-display font-bold text-ink">{t('checkout.deliveryInfo')}</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">{t('checkout.region')}</label>
                      <select value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                        className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition">
                        <option value="">{t('common.select')}</option>
                        {CITIES.map(c => <option key={c.value} value={c.value}>{t(`region.${c.value}`)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">{t('checkout.phone')}</label>
                      <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                        placeholder="+998 ..." className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">{t('checkout.name')}</label>
                      <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                        className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted mb-1">{t('checkout.email')}</label>
                      <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted mb-1">{t('checkout.address')}</label>
                    <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2}
                      placeholder={t('checkout.addressPh')} className="w-full bg-cream text-ink rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition resize-none" />
                  </div>
                  <p className="text-xs text-muted">{t('checkout.payNote')}</p>
                  {error && <p className="text-danger text-sm">{error}</p>}
                  <button onClick={place} disabled={placing}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-4 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50">
                    {placing ? <><Loader2 className="w-5 h-5 animate-spin" /> {t('common.sending')}</> : <>{t('checkout.placeOrder')} <ArrowRight className="w-5 h-5" /></>}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Remove-from-cart confirmation */}
        {confirmRemove && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmRemove(null)} />
            <div className="relative bg-surface rounded-2xl shadow-card p-6 max-w-xs w-full">
              <p className="font-display font-bold text-ink text-lg mb-1">{t('cart.removeTitle')}</p>
              <p className="text-sm text-muted mb-5">
                {t('cart.removeQ', { name: confirmRemove.name })}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmRemove(null)}
                  className="flex-1 bg-cream text-ink text-sm font-semibold py-3 rounded-full active:scale-95 transition">{t('common.no')}</button>
                <button onClick={() => { remove(confirmRemove.id); setConfirmRemove(null) }}
                  className="flex-1 bg-danger text-white text-sm font-semibold py-3 rounded-full active:scale-95 transition">{t('cart.removeYes')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
