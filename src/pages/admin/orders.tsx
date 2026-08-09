import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { requireRole } from '@/lib/guards'
import { createServiceClient } from '@/lib/supabase/api'
import AdminNav from '@/components/AdminNav'
import { formatUZS, formatDate } from '@/lib/format'
import { CITY_LABEL } from '@/consts/geo'
import { CheckCircle, XCircle, Truck, Clock, Loader2, ExternalLink } from 'lucide-react'

type Item = { product_name: string; unit_price: number; qty: number }
type Seller = { id: string; full_name: string; card_number: string | null; city: string | null }
type Order = {
  id: string; status: string; subtotal: number; city: string; address: string
  contact_name: string; contact_phone: string; rejection_reason: string | null; created_at: string
  assigned_seller_id: string | null
  customer_name: string | null; customer_phone: string | null; customer_tg: string | null
  items: Item[]; receipt_url: string | null
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending_payment:        { label: "To'lov kutilmoqda", cls: 'bg-orange-100 text-warning' },
  awaiting_payment_retry: { label: 'Chek qayta kerak',  cls: 'bg-orange-100 text-warning' },
  rejected:               { label: 'Rad etildi',        cls: 'bg-red-100 text-danger' },
  awaiting_confirmation:  { label: 'Tasdiqlash kerak',  cls: 'bg-sky/20 text-sky' },
  confirmed:              { label: 'Tasdiqlangan',      cls: 'bg-green-100 text-success' },
  delivering:             { label: 'Yetkazilmoqda',     cls: 'bg-lavender/20 text-lavender' },
  delivered:              { label: 'Yetkazildi',        cls: 'bg-green-100 text-success' },
  cancelled:              { label: 'Bekor qilindi',     cls: 'bg-gray-100 text-muted' },
}

const TABS = [
  { key: 'review',  label: 'Tasdiqlash',      statuses: ['awaiting_confirmation'] },
  { key: 'payment', label: "To'lov kutilyapti", statuses: ['pending_payment', 'awaiting_payment_retry', 'rejected'] },
  { key: 'active',  label: 'Jarayonda',       statuses: ['confirmed', 'delivering'] },
  { key: 'done',    label: 'Yakunlangan',     statuses: ['delivered', 'cancelled'] },
]

export default function AdminOrders({ orders, sellers }: { orders: Order[]; sellers: Seller[] }) {
  const router = useRouter()
  const [tab, setTab] = useState('review')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const active = TABS.find(t => t.key === tab)!
  const shown = orders.filter(o => active.statuses.includes(o.status))

  async function act(orderId: string, action: string, extra: any = {}) {
    setBusyId(orderId); setError('')
    const res = await fetch('/api/admin/order-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, action, ...extra }),
    })
    const j = await res.json().catch(() => ({}))
    setBusyId(null); setRejectId(null); setReason('')
    if (!res.ok) { setError(j.error ?? 'Xatolik'); return }
    router.replace(router.asPath)   // refresh SSR
  }

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-4 md:p-6 max-w-3xl mx-auto">
        <h2 className="font-display font-bold text-ink text-2xl mb-5">Buyurtmalar</h2>

        <div className="flex gap-2 mb-5 overflow-x-auto">
          {TABS.map(t => {
            const n = orders.filter(o => t.statuses.includes(o.status)).length
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition ${tab === t.key ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'bg-surface text-muted hover:text-ink'}`}>
                {t.label}{n > 0 && <span className="ml-1.5 opacity-80">{n}</span>}
              </button>
            )
          })}
        </div>

        {error && <p className="text-danger text-sm mb-4 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

        {shown.length === 0 ? (
          <div className="bg-surface rounded-2xl shadow-card p-8 text-center text-muted">Bu bo'limda buyurtma yo'q.</div>
        ) : (
          <div className="space-y-4">
            {shown.map(o => {
              const meta = STATUS[o.status] ?? STATUS.pending_payment
              const preConfirm = ['awaiting_confirmation', 'pending_payment', 'awaiting_payment_retry', 'rejected'].includes(o.status)
              return (
                <div key={o.id} className="bg-surface rounded-2xl shadow-card p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                      <p className="text-xs text-muted mt-1.5">{formatDate(o.created_at)}</p>
                    </div>
                    <span className="font-display font-bold text-ink text-lg">{formatUZS(o.subtotal)}</span>
                  </div>

                  {/* Customer + delivery */}
                  <div className="text-sm text-ink space-y-0.5 mb-3">
                    <p className="font-semibold">{o.contact_name} · {o.contact_phone}
                      {o.customer_tg && <span className="text-muted font-normal"> · TG {o.customer_tg}</span>}</p>
                    <p className="text-muted">{CITY_LABEL[o.city] ?? o.city}, {o.address}</p>
                  </div>

                  {/* Items */}
                  <div className="bg-cream rounded-xl p-3 mb-3 text-sm divide-y divide-black/5">
                    {o.items.map((i, k) => (
                      <div key={k} className="flex justify-between py-1.5">
                        <span>{i.product_name} <span className="text-muted">× {i.qty}</span></span>
                        <span className="font-semibold">{formatUZS(i.unit_price * i.qty)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Seller assignment */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-muted">Sotuvchi:</span>
                    <select value={o.assigned_seller_id ?? ''} disabled={busyId === o.id}
                      onChange={e => act(o.id, 'assign', { seller_id: e.target.value })}
                      className="flex-1 bg-cream text-ink rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent">
                      <option value="">— tanlanmagan —</option>
                      {sellers.map(s => <option key={s.id} value={s.id}>{s.full_name}{s.card_number ? '' : ' (karta yo\'q)'}</option>)}
                    </select>
                  </div>

                  {/* Receipt */}
                  {o.receipt_url && (
                    <a href={o.receipt_url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 mb-3 text-sm text-sky font-semibold">
                      <img src={o.receipt_url} alt="chek" className="w-12 h-12 rounded-lg object-cover border border-black/5" />
                      Chekni ochish <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {o.rejection_reason && <p className="text-xs text-danger mb-3">Rad sababi: {o.rejection_reason}</p>}

                  {/* Actions */}
                  {rejectId === o.id ? (
                    <div className="flex gap-2">
                      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Rad etish sababi…"
                        className="flex-1 bg-cream rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-danger border-2 border-transparent" />
                      <button onClick={() => act(o.id, 'reject', { reason })} disabled={busyId === o.id}
                        className="bg-danger text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">Rad etish</button>
                      <button onClick={() => { setRejectId(null); setReason('') }} className="text-muted text-sm px-2">Bekor</button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {busyId === o.id && <span className="flex items-center gap-1.5 text-sm text-muted"><Loader2 className="w-4 h-4 animate-spin" /> …</span>}
                      {preConfirm && (
                        <>
                          <button onClick={() => act(o.id, 'confirm')} disabled={busyId === o.id}
                            className="flex items-center gap-1.5 bg-gradient-to-br from-mint to-success text-white text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition disabled:opacity-50">
                            <CheckCircle className="w-4 h-4" /> Tasdiqlash
                          </button>
                          <button onClick={() => setRejectId(o.id)} disabled={busyId === o.id}
                            className="flex items-center gap-1.5 bg-red-50 text-danger text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition disabled:opacity-50">
                            <XCircle className="w-4 h-4" /> Rad etish
                          </button>
                        </>
                      )}
                      {o.status === 'confirmed' && (
                        <button onClick={() => act(o.id, 'delivering')} disabled={busyId === o.id}
                          className="flex items-center gap-1.5 bg-gradient-to-br from-sky to-lavender text-white text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition disabled:opacity-50">
                          <Truck className="w-4 h-4" /> Yetkazishga berish
                        </button>
                      )}
                      {o.status === 'delivering' && (
                        <button onClick={() => act(o.id, 'delivered')} disabled={busyId === o.id}
                          className="flex items-center gap-1.5 bg-gradient-to-br from-mint to-success text-white text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition disabled:opacity-50">
                          <CheckCircle className="w-4 h-4" /> Yetkazildi
                        </button>
                      )}
                      {o.status !== 'delivered' && o.status !== 'cancelled' && (
                        <button onClick={() => act(o.id, 'cancelled')} disabled={busyId === o.id}
                          className="text-muted hover:text-danger text-sm px-3 py-2 transition">Bekor qilish</button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'admin')
  if (guard) return guard
  const supabase = createServiceClient()

  const { data: rows } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
  const orders0 = rows ?? []
  const ids = orders0.map(o => o.id)
  const custIds = Array.from(new Set(orders0.map(o => o.customer_id).filter(Boolean)))

  const [{ data: items }, { data: custs }, { data: sellers }] = await Promise.all([
    ids.length ? supabase.from('order_items').select('order_id, product_name, unit_price, qty').in('order_id', ids) : Promise.resolve({ data: [] as any[] }),
    custIds.length ? supabase.from('customers').select('id, full_name, phone, telegram_id').in('id', custIds) : Promise.resolve({ data: [] as any[] }),
    supabase.from('profiles').select('id, full_name, card_number, city').eq('role', 'seller').eq('active', true).order('full_name'),
  ])
  const itemsByOrder = new Map<string, Item[]>()
  for (const it of items ?? []) { const a = itemsByOrder.get(it.order_id) ?? []; a.push(it); itemsByOrder.set(it.order_id, a) }
  const custById = new Map((custs ?? []).map((c: any) => [c.id, c]))

  // Signed URLs for the private receipt images.
  const receiptById = new Map<string, string>()
  for (const o of orders0) {
    if (!o.receipt_url) continue
    const { data } = await supabase.storage.from('order-receipts').createSignedUrl(o.receipt_url, 3600)
    if (data?.signedUrl) receiptById.set(o.id, data.signedUrl)
  }

  const orders: Order[] = orders0.map(o => {
    const c: any = custById.get(o.customer_id)
    return {
      id: o.id, status: o.status, subtotal: o.subtotal, city: o.city, address: o.address,
      contact_name: o.contact_name, contact_phone: o.contact_phone,
      rejection_reason: o.rejection_reason, created_at: o.created_at, assigned_seller_id: o.assigned_seller_id,
      customer_name: c?.full_name ?? null, customer_phone: c?.phone ?? null, customer_tg: c?.telegram_id ?? null,
      items: itemsByOrder.get(o.id) ?? [], receipt_url: receiptById.get(o.id) ?? null,
    }
  })

  return { props: { orders, sellers: sellers ?? [] } }
}
