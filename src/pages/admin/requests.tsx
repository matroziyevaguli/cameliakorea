import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { useState } from 'react'
import AdminNav from '@/components/AdminNav'
import { formatDate, formatUZS } from '@/lib/format'
import { Inbox, Check, X, ArrowRight, CheckCircle, ChevronDown } from 'lucide-react'

type Req = {
  id: string
  seller_name: string
  product_name: string
  type: 'correction' | 'new_product'
  current_qty: number
  requested_qty: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  resolved_at: string | null
  qty_allocated_now: number
  qty_sold: number
}
type PriceReq = {
  id: string
  seller_name: string
  product_name: string
  qty: number
  current_price: number
  requested_price: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  resolved_at: string | null
}
type Props = { requests: Req[]; priceRequests: PriceReq[] }

const STATUS_BADGE: Record<Req['status'], { label: string; cls: string }> = {
  pending:  { label: 'Kutilmoqda', cls: 'bg-orange-100 text-warning' },
  approved: { label: 'Tasdiqlandi', cls: 'bg-green-100 text-success' },
  rejected: { label: 'Rad etildi',  cls: 'bg-red-100 text-danger' },
}

export default function Requests({ requests: initReq, priceRequests: initPrice }: Props) {
  // Local state so an approved/rejected request leaves the pending list IMMEDIATELY
  // (don't depend on a server re-fetch — that's why approvals looked "stuck").
  const [requests, setRequests] = useState(initReq)
  const [priceRequests, setPriceRequests] = useState(initPrice)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [showResolved, setShowResolved] = useState(false)

  const pending = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status !== 'pending')
  const pricePending = priceRequests.filter(r => r.status === 'pending')
  const priceResolved = priceRequests.filter(r => r.status !== 'pending')
  const nothing = requests.length === 0 && priceRequests.length === 0
  const resolvedCount = resolved.length + priceResolved.length

  async function resolve(id: string, action: 'approve' | 'reject', bumpStock = false) {
    setBusy(id + action); setError(''); setInfo('')
    const res = await fetch('/api/resolve-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, admin_note: notes[id] || '', bump_stock: bumpStock }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setBusy(null)
      // Approving would exceed recorded stock (the seller received more than was logged) →
      // ask once, then re-approve while raising the product's total to fit. One clear step.
      if (json.need_stock && !bumpStock) {
        const ns = json.need_stock
        const ok = window.confirm(`Omborda ${ns.current} ta bor. Tasdiqlansa ombor ${ns.needed} ta ga oshiriladi. Davom etamizmi?`)
        if (ok) return resolve(id, action, true)
        return
      }
      setError(json.error ?? 'Xatolik'); return
    }
    setBusy(null)
    const now = new Date().toISOString()
    setRequests(rs => rs.map(r => r.id === id
      ? { ...r, status: action === 'approve' ? 'approved' : 'rejected', admin_note: notes[id] || null, resolved_at: now }
      : r))
    setInfo(action === 'approve' ? 'Tasdiqlandi ✓' : 'Rad etildi')
    setTimeout(() => setInfo(''), 3000)
  }

  async function resolvePrice(id: string, action: 'approve' | 'reject') {
    setBusy(id + action); setError(''); setInfo('')
    const res = await fetch('/api/resolve-price-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, admin_note: notes[id] || '' }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) { setError(json.error ?? 'Xatolik'); return }
    const now = new Date().toISOString()
    setPriceRequests(rs => rs.map(r => r.id === id
      ? { ...r, status: action === 'approve' ? 'approved' : 'rejected', admin_note: notes[id] || null, resolved_at: now }
      : r))
    setInfo(action === 'approve' ? 'Tasdiqlandi ✓' : 'Rad etildi')
    setTimeout(() => setInfo(''), 3000)
  }

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Inbox className="w-6 h-6 text-rose" />
          <h2 className="font-display font-bold text-ink text-2xl">Tuzatish so'rovlari</h2>
        </div>

        {error && <p className="text-danger text-sm mb-4">{error}</p>}
        {info && <p className="text-success text-sm font-semibold mb-4 bg-green-50 rounded-xl px-4 py-2.5">{info}</p>}

        {nothing && (
          <div className="bg-surface rounded-2xl shadow-card p-10 text-center text-muted">
            <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Hozircha so'rov yo'q</p>
          </div>
        )}

        {(pending.length > 0 || (showResolved && resolved.length > 0)) && (
          <h3 className="font-display font-bold text-ink text-sm mb-3 px-1">Taqsimot so'rovlari</h3>
        )}

        {/* Pending */}
        {pending.length > 0 && (
          <div className="space-y-3 mb-8">
            {pending.map(r => {
              const belowSold = r.requested_qty < r.qty_sold
              return (
                <div key={r.id} className="bg-surface rounded-2xl shadow-card p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-ink text-sm">{r.seller_name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.type === 'new_product' ? 'bg-sky/15 text-sky' : 'bg-lavender/20 text-ink'}`}>
                          {r.type === 'new_product' ? 'Yangi mahsulot' : 'Tuzatish'}
                        </span>
                      </div>
                      <p className="text-xs text-muted">{r.product_name}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_BADGE[r.status].cls}`}>
                      {STATUS_BADGE[r.status].label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 bg-cream rounded-xl px-4 py-3 mb-3">
                    <span className="font-display font-bold text-xl text-muted">{r.qty_allocated_now}</span>
                    <ArrowRight className="w-4 h-4 text-muted" />
                    <span className="font-display font-bold text-xl text-rose">{r.requested_qty}</span>
                    <span className="text-xs text-muted ml-auto">sotilgan: <strong className="text-ink">{r.qty_sold}</strong></span>
                  </div>

                  {r.reason && <p className="text-sm text-ink bg-lavender/10 rounded-xl px-3 py-2 mb-3">"{r.reason}"</p>}

                  {belowSold && (
                    <p className="text-xs font-semibold text-danger mb-2">
                      {r.qty_sold} ta sotilgan — bundan kam qilib bo'lmaydi.
                    </p>
                  )}

                  <input
                    value={notes[r.id] ?? ''}
                    onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="Izoh (ixtiyoriy)…"
                    className="w-full bg-cream text-ink rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => resolve(r.id, 'approve')}
                      disabled={busy !== null || belowSold}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-br from-mint to-success text-white font-display font-bold py-3 rounded-full text-sm active:scale-95 transition disabled:opacity-50">
                      <Check className="w-4 h-4" />
                      {busy === r.id + 'approve' ? '…' : 'Tasdiqlash'}
                    </button>
                    <button
                      onClick={() => resolve(r.id, 'reject')}
                      disabled={busy !== null}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-danger font-display font-bold py-3 rounded-full text-sm active:scale-95 transition disabled:opacity-50 border border-red-100">
                      <X className="w-4 h-4" />
                      {busy === r.id + 'reject' ? '…' : 'Rad etish'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Price change requests ── */}
        {(pricePending.length > 0 || (showResolved && priceResolved.length > 0)) && (
          <h3 className="font-display font-bold text-ink text-sm mb-3 mt-8 px-1">Narx so'rovlari</h3>
        )}

        {pricePending.length > 0 && (
          <div className="space-y-3 mb-8">
            {pricePending.map(r => (
              <div key={r.id} className="bg-surface rounded-2xl shadow-card p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink text-sm">{r.seller_name}</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-peach/25 text-ink">Narx</span>
                    </div>
                    <p className="text-xs text-muted">{r.product_name} · {r.qty} ta</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS_BADGE[r.status].cls}`}>
                    {STATUS_BADGE[r.status].label}
                  </span>
                </div>

                <div className="flex items-center gap-3 bg-cream rounded-xl px-4 py-3 mb-3">
                  <span className="font-display font-bold text-base text-muted line-through">{formatUZS(r.current_price)}</span>
                  <ArrowRight className="w-4 h-4 text-muted" />
                  <span className="font-display font-bold text-base text-rose">{formatUZS(r.requested_price)}</span>
                </div>

                {r.reason && <p className="text-sm text-ink bg-lavender/10 rounded-xl px-3 py-2 mb-3">"{r.reason}"</p>}

                <input
                  value={notes[r.id] ?? ''}
                  onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="Izoh (ixtiyoriy)…"
                  className="w-full bg-cream text-ink rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent"
                />

                <div className="flex gap-2">
                  <button onClick={() => resolvePrice(r.id, 'approve')} disabled={busy !== null}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-br from-mint to-success text-white font-display font-bold py-3 rounded-full text-sm active:scale-95 transition disabled:opacity-50">
                    <Check className="w-4 h-4" /> {busy === r.id + 'approve' ? '…' : 'Tasdiqlash'}
                  </button>
                  <button onClick={() => resolvePrice(r.id, 'reject')} disabled={busy !== null}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-danger font-display font-bold py-3 rounded-full text-sm active:scale-95 transition disabled:opacity-50 border border-red-100">
                    <X className="w-4 h-4" /> {busy === r.id + 'reject' ? '…' : 'Rad etish'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Collapsible resolved history (both types) — keeps the inbox focused ── */}
        {resolvedCount > 0 && (
          <button onClick={() => setShowResolved(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold text-muted mt-8 mb-4 py-2">
            Ko'rib chiqilgan ({resolvedCount})
            <ChevronDown className={`w-4 h-4 transition ${showResolved ? 'rotate-180' : ''}`} />
          </button>
        )}

        {showResolved && (
          <div className="space-y-2">
            {resolved.map(r => (
              <div key={r.id} className="bg-surface/60 rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
                <CheckCircle className={`w-4 h-4 flex-shrink-0 ${r.status === 'approved' ? 'text-success' : 'text-muted'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate"><strong>{r.seller_name}</strong> · {r.product_name}</p>
                  <p className="text-xs text-muted">
                    {r.current_qty} → {r.requested_qty} ta · {r.resolved_at ? formatDate(r.resolved_at) : ''}
                    {r.admin_note ? ` · ${r.admin_note}` : ''}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${STATUS_BADGE[r.status].cls}`}>
                  {STATUS_BADGE[r.status].label}
                </span>
              </div>
            ))}
            {priceResolved.map(r => (
              <div key={r.id} className="bg-surface/60 rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
                <CheckCircle className={`w-4 h-4 flex-shrink-0 ${r.status === 'approved' ? 'text-success' : 'text-muted'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate"><strong>{r.seller_name}</strong> · {r.product_name} <span className="text-[10px] text-peach">(narx)</span></p>
                  <p className="text-xs text-muted">
                    {formatUZS(r.current_price)} → {formatUZS(r.requested_price)} · {r.resolved_at ? formatDate(r.resolved_at) : ''}
                    {r.admin_note ? ` · ${r.admin_note}` : ''}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${STATUS_BADGE[r.status].cls}`}>
                  {STATUS_BADGE[r.status].label}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'admin')
  if (guard) return guard
  const supabase = createClient(ctx)

  const [{ data }, { data: priceData }] = await Promise.all([
    supabase.from('v_allocation_requests').select('*'),
    supabase.from('v_sale_price_requests').select('*'),
  ])

  return { props: { requests: data ?? [], priceRequests: priceData ?? [] } }
}
