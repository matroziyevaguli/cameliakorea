import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { useState } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import AdminNav from '@/components/AdminNav'
import ConfirmBar from '@/components/ConfirmBar'
import { formatUZS } from '@/lib/format'
import { Layers, Plus, Trash2, X, CalendarClock, AlertTriangle, Truck, PackageCheck, ShoppingCart } from 'lucide-react'
import { expiryInfo, EXPIRY_LABEL, type ExpiryStatus } from '@/lib/expiry'

const EXPIRY_STYLE: Record<ExpiryStatus, string> = {
  expired: 'bg-red-100 text-danger',
  critical: 'bg-orange-100 text-warning',
  soon: 'bg-yellow-100 text-yellow-700',
  ok: 'bg-green-50 text-success',
  none: 'bg-gray-100 text-muted',
}

// Pipeline A, admin side (redesign.md §1.1). A shipment moves left to right.
type BatchStatus = 'ordered' | 'in_transit' | 'arrived' | 'cancelled'
const STATUS: Record<BatchStatus, { label: string; cls: string; icon: any }> = {
  ordered:    { label: 'Buyurtma',  cls: 'bg-lavender/20 text-lavender', icon: ShoppingCart },
  in_transit: { label: "Yo'lda",    cls: 'bg-sky/20 text-sky',           icon: Truck },
  arrived:    { label: 'Keldi',     cls: 'bg-green-100 text-success',    icon: PackageCheck },
  cancelled:  { label: 'Bekor',     cls: 'bg-gray-100 text-muted',       icon: X },
}

type Product = { id: string; name: string; total_qty: number }
type Batch = {
  id: string; product_id: string; lot_label: string | null; quantity: number
  expiry_date: string | null; received_date: string | null; note: string | null
  status: BatchStatus; ordered_date: string | null; eta: string | null; unit_cost: number | null
  created_at: string
}
type Props = { products: Product[]; batches: Batch[] }

const EMPTY_FORM = { quantity: '', expiry_date: '', lot_label: '', note: '', status: 'arrived' as BatchStatus, eta: '', unit_cost: '' }

// FEFO for arrived stock (soonest expiry first); incoming sorted by ETA.
function order(list: Batch[]) {
  const rank = (b: Batch) => (b.status === 'arrived' ? 0 : b.status === 'cancelled' ? 2 : 1)
  return [...list].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    const ka = a.status === 'arrived' ? a.expiry_date : a.eta
    const kb = b.status === 'arrived' ? b.expiry_date : b.eta
    if (!ka && !kb) return 0
    if (!ka) return 1
    if (!kb) return -1
    return ka < kb ? -1 : 1
  })
}

export default function Batches({ products, batches: initial }: Props) {
  const [batches, setBatches] = useState<Batch[]>(initial)
  const [openFor, setOpenFor] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [arrivingId, setArrivingId] = useState<string | null>(null)

  const byProduct = (pid: string) => order(batches.filter(b => b.product_id === pid))

  async function refresh() {
    const supabase = createBrowser()
    const { data } = await supabase.from('product_batches').select('*')
    if (data) setBatches(data as Batch[])
  }

  function openAdd(pid: string) { setOpenFor(pid); setForm(EMPTY_FORM); setError('') }

  async function addBatch(pid: string) {
    if (form.quantity === '' || Number(form.quantity) < 0) { setError("To'g'ri son kiriting"); return }
    setBusy(true); setError('')
    const supabase = createBrowser()
    const { error: err } = await supabase.from('product_batches').insert({
      product_id:  pid,
      quantity:    Number(form.quantity),
      status:      form.status,
      expiry_date: form.expiry_date || null,
      eta:         form.status === 'arrived' ? null : (form.eta || null),
      unit_cost:   form.unit_cost === '' ? null : Number(form.unit_cost),
      lot_label:   form.lot_label.trim() || null,
      note:        form.note.trim() || null,
      ordered_date: form.status === 'ordered' ? new Date().toISOString().slice(0, 10) : null,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setOpenFor(null)
    await refresh()
  }

  // The ONE action when a shipment lands (availability_plan.md §5). The DB trigger
  // stamps received_date; stock and every storefront badge follow automatically.
  async function markArrived(id: string) {
    setArrivingId(id)
    const supabase = createBrowser()
    const { error: err } = await supabase.from('product_batches')
      .update({ status: 'arrived' }).eq('id', id)
    setArrivingId(null)
    if (err) { setError(err.message); return }
    await refresh()
  }

  async function removeBatch(id: string) {
    const supabase = createBrowser()
    await supabase.from('product_batches').delete().eq('id', id)
    setBatches(b => b.filter(x => x.id !== id))
    setConfirmId(null)
  }

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-6 h-6 text-rose" />
          <h2 className="font-display font-bold text-ink text-2xl">Partiyalar</h2>
        </div>
        <p className="text-sm text-muted mb-6">
          Har bir yuborilgan partiya — alohida yozuv. Buyurtma bergandan keyin qo'shing,
          kelganda <b className="text-ink">«Keldi»</b> tugmasini bosing: ombor va sayt o'zi yangilanadi.
        </p>

        <div className="space-y-3">
          {products.map(p => {
            const list = byProduct(p.id)
            const arrivedQty  = list.filter(b => b.status === 'arrived').reduce((n, b) => n + b.quantity, 0)
            const incomingQty = list.filter(b => b.status === 'ordered' || b.status === 'in_transit').reduce((n, b) => n + b.quantity, 0)
            const drift = list.some(b => b.status === 'arrived') && arrivedQty !== p.total_qty
            return (
              <div key={p.id} className="bg-surface rounded-2xl shadow-card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-ink text-sm">{p.name}</p>
                    <p className="text-xs text-muted">
                      Ombor: <strong className="text-ink">{p.total_qty}</strong> ta
                      {list.length > 0 && <> · kelgan: <strong className="text-ink">{arrivedQty}</strong> ta</>}
                      {incomingQty > 0 && <> · <span className="text-sky font-semibold">yo'lda: {incomingQty} ta</span></>}
                    </p>
                  </div>
                  <button onClick={() => openAdd(p.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-br from-rose to-peach text-white px-3 py-1.5 rounded-full active:scale-95 transition flex-shrink-0">
                    <Plus className="w-3.5 h-3.5" /> Partiya
                  </button>
                </div>

                {drift && (
                  <div className="flex items-center gap-1.5 text-xs text-warning bg-orange-50 rounded-lg px-3 py-2 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Kelgan partiyalar ({arrivedQty}) ombor soni ({p.total_qty}) bilan mos emas.
                  </div>
                )}

                {/* Add form */}
                {openFor === p.id && (
                  <div className="bg-cream rounded-xl p-3 space-y-2 mb-3">
                    {/* Status picker — where this shipment is right now */}
                    <div className="flex gap-1.5">
                      {(['ordered', 'in_transit', 'arrived'] as BatchStatus[]).map(st => (
                        <button key={st} onClick={() => setForm(f => ({ ...f, status: st }))}
                          className={`flex-1 text-xs font-semibold py-2 rounded-lg transition ${form.status === st ? 'bg-gradient-to-br from-rose to-peach text-white' : 'bg-surface text-muted'}`}>
                          {STATUS[st].label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-muted mb-1">Soni</label>
                        <input type="number" min={0} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                          className="w-full bg-surface text-ink rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Dona narxi (xarid)</label>
                        <input type="number" min={0} value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))}
                          placeholder="ixtiyoriy"
                          className="w-full bg-surface text-ink rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Yaroqlilik muddati</label>
                        <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                          className="w-full bg-surface text-ink rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                      </div>
                      {form.status !== 'arrived' && (
                        <div>
                          <label className="block text-xs text-muted mb-1">Kutilmoqda (ichki)</label>
                          <input type="date" value={form.eta} onChange={e => setForm(f => ({ ...f, eta: e.target.value }))}
                            className="w-full bg-surface text-ink rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                        </div>
                      )}
                    </div>

                    <input value={form.lot_label} onChange={e => setForm(f => ({ ...f, lot_label: e.target.value }))} placeholder="Partiya nomi / lot (ixtiyoriy)"
                      className="w-full bg-surface text-ink rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                    <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Izoh (ixtiyoriy)"
                      className="w-full bg-surface text-ink rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />

                    {form.status !== 'arrived' && (
                      <p className="text-[11px] text-muted leading-snug">
                        Hali kelmagan partiya omborga qo'shilmaydi. Saytda mahsulot{' '}
                        <b className="text-sky">«Yo'lda»</b> deb ko'rinadi. Kelganda «Keldi» bosing.
                      </p>
                    )}
                    {error && <p className="text-danger text-xs">{error}</p>}
                    <div className="flex gap-2">
                      <button disabled={busy} onClick={() => addBatch(p.id)}
                        className="flex-1 bg-rose text-white text-xs font-semibold py-2 rounded-lg disabled:opacity-50">
                        {busy ? 'Saqlanmoqda…' : "Qo'shish"}
                      </button>
                      <button aria-label="Yopish" onClick={() => setOpenFor(null)} className="px-3 text-muted"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                )}

                {/* Batch list — arrived first (FEFO), then incoming by ETA */}
                {list.length === 0 ? (
                  <p className="text-xs text-muted">Partiya qo'shilmagan.</p>
                ) : (
                  <div className="space-y-1.5">
                    {list.map((b, i) => {
                      if (confirmId === b.id) return (
                        <div key={b.id} className="bg-cream rounded-lg px-3 pb-2">
                          <ConfirmBar
                            question={`${b.quantity} ta partiyani o'chirasizmi?`}
                            confirmLabel="Ha, o'chirish"
                            onConfirm={() => removeBatch(b.id)}
                            onCancel={() => setConfirmId(null)}
                          />
                        </div>
                      )
                      const { status: expSt } = expiryInfo(b.expiry_date)
                      const meta = STATUS[b.status] ?? STATUS.arrived
                      const Icon = meta.icon
                      const firstArrived = b.status === 'arrived' && i === 0 && list.filter(x => x.status === 'arrived').length > 1
                      return (
                        <div key={b.id} className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ${b.status === 'arrived' ? 'bg-cream' : 'bg-sky/5 border border-sky/20'}`}>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${meta.cls}`}>
                            <Icon className="w-3 h-3" /> {meta.label}
                          </span>
                          {firstArrived && (
                            <span className="text-[10px] font-bold text-rose bg-rose/10 px-1.5 py-0.5 rounded-full flex-shrink-0">1-navbat</span>
                          )}
                          <span className="font-display font-bold text-ink text-sm">{b.quantity} ta</span>
                          {b.unit_cost != null && <span className="text-[11px] text-muted">· {formatUZS(b.unit_cost)}/dona</span>}
                          {b.lot_label && <span className="text-xs text-muted truncate">· {b.lot_label}</span>}

                          <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                            {b.status !== 'arrived' && b.status !== 'cancelled' && (
                              <>
                                {b.eta && <span className="text-[11px] text-sky">kutilmoqda: {b.eta}</span>}
                                <button onClick={() => markArrived(b.id)} disabled={arrivingId === b.id}
                                  className="flex items-center gap-1 text-[11px] font-bold bg-gradient-to-br from-mint to-success text-white px-3 py-1.5 rounded-full active:scale-95 transition disabled:opacity-50">
                                  <PackageCheck className="w-3.5 h-3.5" />
                                  {arrivingId === b.id ? '…' : 'Keldi'}
                                </button>
                              </>
                            )}
                            {b.status === 'arrived' && (b.expiry_date ? (
                              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${EXPIRY_STYLE[expSt]}`}>
                                <CalendarClock className="w-3 h-3" />
                                {b.expiry_date}{expSt !== 'ok' && expSt !== 'none' ? ` · ${EXPIRY_LABEL[expSt]}` : ''}
                              </span>
                            ) : <span className="text-[11px] text-muted">muddat yo'q</span>)}
                            <button onClick={() => setConfirmId(b.id)} aria-label="Partiyani o'chirish"
                              className="text-muted hover:text-danger transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'admin')
  if (guard) return guard
  const supabase = createClient(ctx)

  // Read product_batches directly, not v_batches: that view has a fixed column list
  // from docs/batches-setup.md and does not expose `status`/`eta`/`unit_cost`.
  // RLS (`batches_select`) already allows any authenticated user to read it.
  const [{ data: products }, { data: batches }] = await Promise.all([
    supabase.from('products').select('id, name, total_qty').order('name'),
    supabase.from('product_batches').select('*'),
  ])

  return { props: { products: products ?? [], batches: batches ?? [] } }
}
