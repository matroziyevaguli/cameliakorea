import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatDate } from '@/lib/format'
import { useState, useMemo } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import SellerNav from '@/components/SellerNav'
import { RotateCcw, Plus, Minus, X, ArrowRight, ArrowDown, ArrowUp, ChevronDown } from 'lucide-react'

type MyTransfer = {
  id: string; qty: number; status: 'pending' | 'approved' | 'rejected'
  from_name: string; to_name: string; product_name: string; product_id?: string | null
  is_outgoing: boolean; created_at: string
}
type Sendable = { product_id: string; product_name: string; remaining: number }
type Seller = { id: string; full_name: string }
type Props = {
  transfers: MyTransfer[]; sendable: Sendable[]; otherSellers: Seller[]
  remainingByProduct: Record<string, number>       // product_id → current stock
  imageByProduct: Record<string, string | null>
  hasProductId: boolean
}

const BADGE: Record<MyTransfer['status'], { label: string; cls: string }> = {
  pending:  { label: 'Kutilmoqda', cls: 'bg-orange-100 text-warning' },
  approved: { label: 'Tasdiqlandi', cls: 'bg-green-100 text-success' },
  rejected: { label: 'Rad etildi',  cls: 'bg-red-100 text-danger' },
}

const GRADIENTS = ['from-rose to-peach', 'from-lavender to-sky', 'from-mint to-sky', 'from-peach to-rose']
function Thumb({ name, url, i, className = '' }: { name: string; url?: string | null; i: number; className?: string }) {
  if (url) return <img src={url} alt={name} className={`object-cover ${className}`} />
  return (
    <div className={`bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} grid place-items-center ${className}`}>
      <span className="font-display font-bold text-white/80 text-lg">{name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

// The whole point of the page: her stock now → her stock after this return moves.
function BeforeAfter({ before, after, afterLabel }: { before: number; after: number; afterLabel: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-muted">Sizda: <b className="text-ink">{before} ta</b></span>
      <ArrowRight className="w-3.5 h-3.5 text-muted" />
      <span className="text-muted">{afterLabel}: <b className={after < before ? 'text-warning' : 'text-success'}>{after} ta</b></span>
    </span>
  )
}

export default function SellerTransfers({ transfers: initialTransfers, sendable, otherSellers, remainingByProduct, imageByProduct, hasProductId }: Props) {
  // G2 — local state is the source of truth for the screen; reconcile in the background.
  const [transfers, setTransfers] = useState<MyTransfer[]>(initialTransfers)
  const incoming = transfers.filter(t => !t.is_outgoing && t.status === 'pending')
  const [txBusy, setTxBusy] = useState<string | null>(null)
  const [txError, setTxError] = useState('')

  async function reconcile() {
    const supabase = createBrowser()
    const cols = hasProductId
      ? 'id, qty, status, from_name, to_name, product_name, product_id, is_outgoing, created_at'
      : 'id, qty, status, from_name, to_name, product_name, is_outgoing, created_at'
    const { data } = await supabase.from('v_my_transfers').select(cols)
    if (data) setTransfers(data as unknown as MyTransfer[])
  }

  async function confirmTransfer(id: string, action: 'approve' | 'reject') {
    setTxBusy(id + action); setTxError('')
    const res = await fetch('/api/confirm-transfer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }),
    })
    const json = await res.json().catch(() => ({}))
    setTxBusy(null)
    if (!res.ok) { setTxError(json.error ?? 'Xatolik'); return }
    setTransfers(list => list.map(t => t.id === id
      ? { ...t, status: action === 'approve' ? 'approved' : 'rejected' } : t))
    window.dispatchEvent(new Event('camelia-transfers-changed'))
    reconcile()
  }

  // ── Grouped-by-product overview (the core request) ────────────────────────
  const keyOf = (t: MyTransfer) => (hasProductId && t.product_id) ? t.product_id : `name:${t.product_name}`
  const groups = useMemo(() => {
    type G = {
      key: string; name: string; image: string | null; remaining: number
      out: number; in: number; pending: number; rows: MyTransfer[]; last: string
    }
    const map: Record<string, G> = {}
    for (const t of transfers) {
      const key = keyOf(t)
      const g = map[key] ??= {
        key, name: t.product_name,
        image: (hasProductId && t.product_id) ? (imageByProduct[t.product_id] ?? null) : null,
        remaining: (hasProductId && t.product_id) ? (remainingByProduct[t.product_id] ?? 0) : 0,
        out: 0, in: 0, pending: 0, rows: [], last: t.created_at,
      }
      g.rows.push(t)
      if (t.status === 'pending') g.pending++
      else if (t.status === 'approved') { if (t.is_outgoing) g.out += t.qty; else g.in += t.qty }
      if (t.created_at > g.last) g.last = t.created_at
    }
    return Object.values(map)
      .map(g => ({ ...g, rows: g.rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)) }))
      .sort((a, b) => (a.last < b.last ? 1 : -1))
  }, [transfers]) // eslint-disable-line react-hooks/exhaustive-deps

  const [openKey, setOpenKey] = useState<string | null>(null)

  // ── New return form ───────────────────────────────────────────────────────
  const mainSeller = otherSellers.find(s => /gulshan/i.test(s.full_name)) ?? otherSellers[0]
  const [showForm, setShowForm] = useState(false)
  const [productId, setProductId] = useState('')
  const [to, setTo] = useState(mainSeller?.id ?? '')
  const [qty, setQty] = useState(1)
  const [sendBusy, setSendBusy] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sendDone, setSendDone] = useState(false)
  const selected = sendable.find(p => p.product_id === productId)
  const maxQty = selected?.remaining ?? 1

  function openForm() {
    setShowForm(true); setProductId(''); setTo(mainSeller?.id ?? ''); setQty(1); setSendError(''); setSendDone(false)
  }
  async function submitSend() {
    if (!productId) { setSendError('Mahsulotni tanlang'); return }
    if (!to) { setSendError('Qabul qiluvchini tanlang'); return }
    setSendBusy(true); setSendError('')
    const res = await fetch('/api/transfer-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, to_seller_id: to, qty }),
    })
    const json = await res.json().catch(() => ({}))
    setSendBusy(false)
    if (!res.ok) { setSendError(json.error ?? 'Xatolik'); return }
    setSendDone(true)
    setTimeout(() => { setShowForm(false); reconcile() }, 1200)
  }

  const canSend = sendable.length > 0 && otherSellers.length > 0

  return (
    <div className="min-h-screen bg-cream pb-28">
      <header className="bg-gradient-to-br from-rose to-peach text-white px-5 pt-10 pb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/4" />
        <div className="relative flex items-center gap-2">
          <RotateCcw className="w-5 h-5" />
          <h1 className="font-display text-xl font-bold">Qaytarishlar</h1>
        </div>
        <p className="relative text-white/80 text-sm mt-1">Sotilmagan mahsulotni boshqa sotuvchiga qaytaring — pul o'zgarmaydi.</p>
      </header>

      <main className="px-4 -mt-4 relative z-10 space-y-4">

        {/* New transfer */}
        {canSend && (
          <div className="bg-surface rounded-2xl shadow-card p-4">
            {!showForm ? (
              <button onClick={openForm}
                className="w-full flex items-center justify-center gap-2 text-rose font-display font-bold py-2 rounded-xl">
                <Plus className="w-5 h-5" /> Yangi qaytarish
              </button>
            ) : sendDone ? (
              <div className="text-center py-3 rounded-xl bg-green-50 text-success font-semibold text-sm">✅ So'rov yuborildi — qabul qiluvchi tasdiqlaydi</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-display font-bold text-ink text-sm">Yangi qaytarish</p>
                  <button aria-label="Yopish" onClick={() => setShowForm(false)} className="text-muted"><X className="w-4 h-4" /></button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Mahsulot</label>
                  <select value={productId} onChange={e => { setProductId(e.target.value); setQty(1) }}
                    className="w-full bg-cream text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent">
                    <option value="">Tanlang…</option>
                    {sendable.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name} ({p.remaining} ta)</option>)}
                  </select>
                </div>

                {/* Chosen product with a real thumbnail + live before→after */}
                {selected && (
                  <div className="flex items-center gap-3 bg-cream rounded-xl p-3">
                    <Thumb name={selected.product_name} url={imageByProduct[selected.product_id]} i={0} className="w-14 h-14 rounded-xl flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-ink text-sm truncate">{selected.product_name}</p>
                      <div className="mt-1"><BeforeAfter before={selected.remaining} after={selected.remaining - qty} afterLabel="qaytargach" /></div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Kimga</label>
                  <select value={to} onChange={e => setTo(e.target.value)}
                    className="w-full bg-cream text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent">
                    {otherSellers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-2">Nechta?{selected ? ` (mavjud: ${maxQty})` : ''}</label>
                  <div className="flex items-center justify-center gap-6">
                    <button aria-label="Kamaytirish" onClick={() => setQty(q => Math.max(1, q - 1))}
                      className="w-11 h-11 rounded-full bg-cream text-ink grid place-items-center active:scale-90 transition"><Minus className="w-5 h-5" /></button>
                    <span className="font-display text-2xl font-bold text-ink w-10 text-center">{qty}</span>
                    <button aria-label="Ko'paytirish" onClick={() => setQty(q => Math.min(maxQty, q + 1))}
                      className="w-11 h-11 rounded-full bg-gradient-to-br from-rose to-peach text-white grid place-items-center active:scale-90 transition shadow-rose"><Plus className="w-5 h-5" /></button>
                  </div>
                </div>

                {sendError && <p className="text-danger text-xs text-center">{sendError}</p>}
                <button onClick={submitSend} disabled={sendBusy || !productId}
                  className="w-full bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-3 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50">
                  {sendBusy ? 'Yuborilmoqda…' : 'Yuborish'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Incoming — needs my confirmation, with my before→after */}
        {incoming.length > 0 && (
          <div>
            <h2 className="font-display font-bold text-ink text-base mb-2 px-1">Sizga qaytarilmoqda</h2>
            <div className="space-y-2">
              {incoming.map((t, i) => {
                const have = (hasProductId && t.product_id) ? (remainingByProduct[t.product_id] ?? 0) : null
                return (
                  <div key={t.id} className="bg-mint/10 border border-mint/30 rounded-2xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                      {hasProductId && t.product_id && (
                        <Thumb name={t.product_name} url={imageByProduct[t.product_id]} i={i} className="w-14 h-14 rounded-xl flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink"><span className="text-success">{t.from_name}</span> sizga qaytarmoqchi</p>
                        <p className="text-sm text-muted">{t.product_name} — <strong className="text-ink">{t.qty} ta</strong></p>
                        {have !== null && (
                          <div className="mt-1"><BeforeAfter before={have} after={have + t.qty} afterLabel="qabul qilsangiz" /></div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => confirmTransfer(t.id, 'approve')} disabled={txBusy !== null}
                        className="flex-1 bg-gradient-to-br from-mint to-success text-white font-display font-bold py-2.5 rounded-full text-sm active:scale-95 transition disabled:opacity-50">Qabul qildim</button>
                      <button onClick={() => confirmTransfer(t.id, 'reject')} disabled={txBusy !== null}
                        className="flex-1 bg-red-50 text-danger font-display font-bold py-2.5 rounded-full text-sm active:scale-95 transition disabled:opacity-50 border border-red-100">Rad etish</button>
                    </div>
                  </div>
                )
              })}
              {txError && <p className="text-danger text-xs px-1 mt-1">{txError}</p>}
            </div>
          </div>
        )}

        {/* Grouped-by-product overview table */}
        <div>
          <h2 className="font-display font-bold text-ink text-base mb-1 px-1">Sizning qaytarishlaringiz</h2>
          {groups.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card p-10 text-center text-muted">
              <RotateCcw className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Hali qaytarish yo'q</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-muted mb-2 px-1">
                <b className="text-rose">Chiqdi</b> — qaytarganingiz · <b className="text-success">Kirdi</b> — sizga qaytarilgani · <b className="text-ink">Hozir</b> — hozirgi soningiz
              </p>

              <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
                {/* Column header */}
                <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 text-[11px] font-semibold text-muted">
                  <span className="w-11 flex-shrink-0" />
                  <span className="flex-1">Mahsulot</span>
                  <span className="w-12 text-right">Chiqdi</span>
                  <span className="w-12 text-right">Kirdi</span>
                  <span className="w-12 text-right">Hozir</span>
                  <span className="w-5 flex-shrink-0" />
                </div>

                <div className="divide-y divide-gray-100">
                  {groups.map((g, gi) => {
                    const open = openKey === g.key
                    return (
                      <div key={g.key}>
                        <button onClick={() => setOpenKey(k => (k === g.key ? null : g.key))}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-cream/60 transition">
                          <Thumb name={g.name} url={g.image} i={gi} className="w-11 h-11 rounded-xl flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{g.name}</p>
                            {g.pending > 0 && (
                              <span className="text-[10px] font-bold text-warning bg-orange-50 px-1.5 py-0.5 rounded-full">{g.pending} kutilmoqda</span>
                            )}
                          </div>
                          <span className="w-12 text-right text-sm">
                            {g.out > 0 ? <span className="inline-flex items-center gap-0.5 font-semibold text-rose"><ArrowDown className="w-3 h-3" />{g.out}</span> : <span className="text-muted/40">—</span>}
                          </span>
                          <span className="w-12 text-right text-sm">
                            {g.in > 0 ? <span className="inline-flex items-center gap-0.5 font-semibold text-success"><ArrowUp className="w-3 h-3" />{g.in}</span> : <span className="text-muted/40">—</span>}
                          </span>
                          <span className="w-12 text-right font-display font-bold text-ink text-sm">{hasProductId ? `${g.remaining}` : '—'}</span>
                          <ChevronDown className={`w-4 h-4 text-muted flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
                        </button>

                        {open && (
                          <div className="bg-cream/40 px-3 pb-3 pt-1 space-y-1.5">
                            {g.rows.map(t => (
                              <div key={t.id} className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2">
                                <RotateCcw className={`w-3.5 h-3.5 flex-shrink-0 ${t.is_outgoing ? 'text-rose' : 'text-success'}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs text-ink truncate">
                                    {t.is_outgoing ? `Siz → ${t.to_name}` : `${t.from_name} → Siz`} · <strong>{t.qty} ta</strong>
                                  </p>
                                  <p className="text-[11px] text-muted">{formatDate(t.created_at)}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${BADGE[t.status].cls}`}>{BADGE[t.status].label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <SellerNav />
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'seller')
  if (guard) return guard
  const supabase = createClient(ctx)
  const { data: { session } } = await supabase.auth.getSession()
  const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', session!.user.id).single()

  // `product_id` on v_my_transfers only exists once docs/transfers-product-id.md is run.
  // Probe once; on failure fall back to the column set without it and group by name.
  const withId = 'id, qty, status, from_name, to_name, product_name, product_id, is_outgoing, created_at'
  const withoutId = 'id, qty, status, from_name, to_name, product_name, is_outgoing, created_at'
  let transfersRes = await supabase.from('v_my_transfers').select(withId)
  const hasProductId = !transfersRes.error
  if (transfersRes.error) transfersRes = await supabase.from('v_my_transfers').select(withoutId)

  const [invRes, sellersRes, catalogRes] = await Promise.all([
    supabase.from('v_my_inventory').select('product_id, product_name, remaining'),
    supabase.from('v_seller_names').select('id, full_name'),
    supabase.from('v_catalog').select('id, image_url'),
  ])

  const inv = invRes.data ?? []
  const sendable: Sendable[] = inv
    .filter((i: any) => i.remaining > 0)
    .map((i: any) => ({ product_id: i.product_id, product_name: i.product_name, remaining: i.remaining }))

  const remainingByProduct: Record<string, number> = {}
  for (const i of inv as any[]) remainingByProduct[i.product_id] = i.remaining

  const imageByProduct: Record<string, string | null> = {}
  for (const c of (catalogRes.data ?? []) as any[]) imageByProduct[c.id] = c.image_url ?? null

  return {
    props: {
      transfers: transfersRes.data ?? [],
      sendable,
      otherSellers: (sellersRes.data ?? []).filter((s: any) => s.id !== profile?.id),
      remainingByProduct,
      imageByProduct,
      hasProductId,
    },
  }
}
