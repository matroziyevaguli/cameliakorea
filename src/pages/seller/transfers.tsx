import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatDate } from '@/lib/format'
import { useState } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import SellerNav from '@/components/SellerNav'
import { RotateCcw, Plus, Minus, X } from 'lucide-react'

type MyTransfer = {
  id: string; qty: number; status: 'pending' | 'approved' | 'rejected'
  from_name: string; to_name: string; product_name: string; is_outgoing: boolean; created_at: string
}
type Sendable = { product_id: string; product_name: string; remaining: number }
type Seller = { id: string; full_name: string }
type Props = { transfers: MyTransfer[]; sendable: Sendable[]; otherSellers: Seller[] }

const BADGE: Record<MyTransfer['status'], { label: string; cls: string }> = {
  pending:  { label: 'Kutilmoqda', cls: 'bg-orange-100 text-warning' },
  approved: { label: 'Tasdiqlandi', cls: 'bg-green-100 text-success' },
  rejected: { label: 'Rad etildi',  cls: 'bg-red-100 text-danger' },
}

export default function SellerTransfers({ transfers: initialTransfers, sendable, otherSellers }: Props) {
  // G2 — local state is the source of truth for the screen; reconcile in the background.
  const [transfers, setTransfers] = useState<MyTransfer[]>(initialTransfers)
  const incoming = transfers.filter(t => !t.is_outgoing && t.status === 'pending')
  const history = transfers.filter(t => t.is_outgoing || t.status !== 'pending')
  const [txBusy, setTxBusy] = useState<string | null>(null)
  const [txError, setTxError] = useState('')

  async function reconcile() {
    const supabase = createBrowser()
    const { data } = await supabase.from('v_my_transfers')
      .select('id, qty, status, from_name, to_name, product_name, is_outgoing, created_at')
    if (data) setTransfers(data as MyTransfer[])
  }

  async function confirmTransfer(id: string, action: 'approve' | 'reject') {
    setTxBusy(id + action); setTxError('')
    const res = await fetch('/api/confirm-transfer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }),
    })
    const json = await res.json().catch(() => ({}))
    setTxBusy(null)
    if (!res.ok) { setTxError(json.error ?? 'Xatolik'); return }
    // Optimistic: move it straight into history with its new status.
    setTransfers(list => list.map(t => t.id === id
      ? { ...t, status: action === 'approve' ? 'approved' : 'rejected' } : t))
    window.dispatchEvent(new Event('camelia-transfers-changed'))
    reconcile()
  }

  // Send a new return
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

        {/* Incoming — needs my confirmation */}
        {incoming.length > 0 && (
          <div>
            <h2 className="font-display font-bold text-ink text-base mb-2 px-1">Sizga qaytarilmoqda</h2>
            <div className="space-y-2">
              {incoming.map(t => (
                <div key={t.id} className="bg-mint/10 border border-mint/30 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-ink"><span className="text-success">{t.from_name}</span> sizga qaytarmoqchi</p>
                  <p className="text-sm text-muted mb-3">{t.product_name} — <strong className="text-ink">{t.qty} ta</strong></p>
                  <div className="flex gap-2">
                    <button onClick={() => confirmTransfer(t.id, 'approve')} disabled={txBusy !== null}
                      className="flex-1 bg-gradient-to-br from-mint to-success text-white font-display font-bold py-2.5 rounded-full text-sm active:scale-95 transition disabled:opacity-50">Qabul qildim</button>
                    <button onClick={() => confirmTransfer(t.id, 'reject')} disabled={txBusy !== null}
                      className="flex-1 bg-red-50 text-danger font-display font-bold py-2.5 rounded-full text-sm active:scale-95 transition disabled:opacity-50 border border-red-100">Rad etish</button>
                  </div>
                </div>
              ))}
              {txError && <p className="text-danger text-xs px-1 mt-1">{txError}</p>}
            </div>
          </div>
        )}

        {/* History */}
        <div>
          <h2 className="font-display font-bold text-ink text-base mb-2 px-1">Tarix</h2>
          {history.length === 0 && incoming.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card p-10 text-center text-muted">
              <RotateCcw className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Hali qaytarish yo'q</p>
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted px-1">Tarix bo'sh.</p>
          ) : (
            <div className="space-y-2">
              {history.map(t => (
                <div key={t.id} className="bg-surface rounded-2xl shadow-card px-4 py-3 flex items-center gap-3">
                  <RotateCcw className={`w-4 h-4 flex-shrink-0 ${t.is_outgoing ? 'text-rose' : 'text-success'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink truncate">{t.product_name} · <strong>{t.qty} ta</strong></p>
                    <p className="text-xs text-muted">{t.is_outgoing ? `Siz → ${t.to_name}` : `${t.from_name} → Siz`} · {formatDate(t.created_at)}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${BADGE[t.status].cls}`}>{BADGE[t.status].label}</span>
                </div>
              ))}
            </div>
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

  const [transfersRes, invRes, sellersRes] = await Promise.all([
    supabase.from('v_my_transfers').select('id, qty, status, from_name, to_name, product_name, is_outgoing, created_at'),
    supabase.from('v_my_inventory').select('product_id, product_name, remaining'),
    supabase.from('v_seller_names').select('id, full_name'),
  ])

  const sendable: Sendable[] = (invRes.data ?? [])
    .filter((i: any) => i.remaining > 0)
    .map((i: any) => ({ product_id: i.product_id, product_name: i.product_name, remaining: i.remaining }))

  return {
    props: {
      transfers: transfersRes.data ?? [],
      sendable,
      otherSellers: (sellersRes.data ?? []).filter((s: any) => s.id !== profile?.id),
    },
  }
}
