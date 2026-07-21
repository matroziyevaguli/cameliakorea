import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import AdminNav from '@/components/AdminNav'
import ConfirmBar from '@/components/ConfirmBar'
import { Layers, Plus, Trash2, X, CalendarClock, AlertTriangle } from 'lucide-react'
import { expiryInfo, EXPIRY_LABEL, type ExpiryStatus } from '@/lib/expiry'

const EXPIRY_STYLE: Record<ExpiryStatus, string> = {
  expired: 'bg-red-100 text-danger',
  critical: 'bg-orange-100 text-warning',
  soon: 'bg-yellow-100 text-yellow-700',
  ok: 'bg-green-50 text-success',
  none: 'bg-gray-100 text-muted',
}

type Product = { id: string; name: string; total_qty: number }
type Batch = {
  id: string; product_id: string; lot_label: string | null; quantity: number
  expiry_date: string | null; received_date: string; note: string | null
}
type Props = { products: Product[]; batches: Batch[] }

const EMPTY_FORM = { quantity: '', expiry_date: '', lot_label: '', note: '' }

export default function Batches({ products, batches: initial }: Props) {
  const router = useRouter()
  const [batches, setBatches] = useState<Batch[]>(initial)
  const [openFor, setOpenFor] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const byProduct = (pid: string) => batches.filter(b => b.product_id === pid)

  async function refresh() {
    const supabase = createBrowser()
    const { data } = await supabase.from('v_batches').select('*')
    if (data) setBatches(data as Batch[])
  }

  function openAdd(pid: string) {
    setOpenFor(pid); setForm(EMPTY_FORM); setError('')
  }

  async function addBatch(pid: string) {
    if (form.quantity === '' || Number(form.quantity) < 0) { setError("To'g'ri son kiriting"); return }
    setBusy(true); setError('')
    const supabase = createBrowser()
    const { error: err } = await supabase.from('product_batches').insert({
      product_id: pid,
      quantity: Number(form.quantity),
      expiry_date: form.expiry_date || null,
      lot_label: form.lot_label.trim() || null,
      note: form.note.trim() || null,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setOpenFor(null)
    await refresh()
  }

  const [confirmId, setConfirmId] = useState<string | null>(null)
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
          Har bir kelgan partiyani alohida yozing — o'z muddati bilan. Ro'yxat eng tez tugaydigan
          muddat bo'yicha tartiblangan (FEFO — avval shuni soting).
        </p>

        <div className="space-y-3">
          {products.map(p => {
            const list = byProduct(p.id)
            const batchTotal = list.reduce((n, b) => n + b.quantity, 0)
            const drift = list.length > 0 && batchTotal !== p.total_qty
            return (
              <div key={p.id} className="bg-surface rounded-2xl shadow-card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-semibold text-ink text-sm">{p.name}</p>
                    <p className="text-xs text-muted">
                      Ombor: <strong className="text-ink">{p.total_qty}</strong> ta
                      {list.length > 0 && <> · partiyalarda: <strong className="text-ink">{batchTotal}</strong> ta</>}
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
                    Partiyalar yig'indisi ({batchTotal}) ombor soni ({p.total_qty}) bilan mos emas.
                  </div>
                )}

                {/* Add form */}
                {openFor === p.id && (
                  <div className="bg-cream rounded-xl p-3 space-y-2 mb-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-muted mb-1">Soni</label>
                        <input type="number" min={0} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                          className="w-full bg-surface text-ink rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted mb-1">Yaroqlilik muddati</label>
                        <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                          className="w-full bg-surface text-ink rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                      </div>
                    </div>
                    <input value={form.lot_label} onChange={e => setForm(f => ({ ...f, lot_label: e.target.value }))} placeholder="Partiya nomi / lot (ixtiyoriy)"
                      className="w-full bg-surface text-ink rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                    <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Izoh (ixtiyoriy)"
                      className="w-full bg-surface text-ink rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
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

                {/* Batch list (already FEFO from v_batches) */}
                {list.length === 0 ? (
                  <p className="text-xs text-muted">Partiya qo'shilmagan.</p>
                ) : (
                  <div className="space-y-1.5">
                    {list.map((b, i) => {
                      const { status } = expiryInfo(b.expiry_date)
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
                      return (
                        <div key={b.id} className="flex items-center gap-2 bg-cream rounded-lg px-3 py-2">
                          {i === 0 && list.length > 1 && (
                            <span className="text-[10px] font-bold text-rose bg-rose/10 px-1.5 py-0.5 rounded-full flex-shrink-0">1-navbat</span>
                          )}
                          <span className="font-display font-bold text-ink text-sm">{b.quantity} ta</span>
                          {b.lot_label && <span className="text-xs text-muted truncate">· {b.lot_label}</span>}
                          <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                            {b.expiry_date ? (
                              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${EXPIRY_STYLE[status]}`}>
                                <CalendarClock className="w-3 h-3" />
                                {b.expiry_date}{status !== 'ok' && status !== 'none' ? ` · ${EXPIRY_LABEL[status]}` : ''}
                              </span>
                            ) : <span className="text-[11px] text-muted">muddat yo'q</span>}
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

  const [{ data: products }, { data: batches }] = await Promise.all([
    supabase.from('products').select('id, name, total_qty').order('name'),
    supabase.from('v_batches').select('*'),
  ])

  return { props: { products: products ?? [], batches: batches ?? [] } }
}
