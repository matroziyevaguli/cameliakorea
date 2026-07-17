import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { useState, useMemo } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import AdminNav from '@/components/AdminNav'
import { Share2, CheckCircle } from 'lucide-react'

type Product = { id: string; name: string; total_qty: number }
type Seller = { id: string; full_name: string }
// current allocation + sold, keyed "productId|sellerId"
type Cell = { allocated: number; sold: number }

type Props = {
  products: Product[]
  sellers: Seller[]
  cells: Record<string, Cell>
}

export default function Distribute({ products, sellers, cells: initialCells }: Props) {
  const [cells, setCells] = useState(initialCells)
  const [productId, setProductId] = useState('')
  const [qtys, setQtys] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const selected = products.find(p => p.id === productId)

  const cellFor = (sid: string): Cell => cells[`${productId}|${sid}`] ?? { allocated: 0, sold: 0 }

  // Pre-fill each seller's box with their CURRENT allocation when a product is picked.
  function pickProduct(pid: string) {
    setProductId(pid); setError(''); setSuccess(false)
    if (!pid) { setQtys({}); return }
    const next: Record<string, string> = {}
    for (const s of sellers) {
      const c = cells[`${pid}|${s.id}`]
      next[s.id] = c && c.allocated > 0 ? String(c.allocated) : ''
    }
    setQtys(next)
  }

  // Live totals (inputs are the NEW total allocation per seller — replace semantics)
  const totalAssigning = useMemo(
    () => sellers.reduce((sum, s) => sum + (Number(qtys[s.id]) || 0), 0),
    [qtys, sellers]
  )
  const unallocated = selected ? selected.total_qty - totalAssigning : 0
  const overLimit = selected ? totalAssigning > selected.total_qty : false

  // Per-seller validation: cannot set below what they've already sold.
  const belowSold = useMemo(() => sellers.filter(s => {
    const raw = qtys[s.id]
    if (raw === '' || raw === undefined) return false
    return Number(raw) < cellFor(s.id).sold
  }), [qtys, productId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!selected || overLimit || belowSold.length) return
    setLoading(true); setError('')
    const supabase = createBrowser()

    // Build per-seller ops. Use explicit update/insert (NOT upsert): an upsert fires the
    // BEFORE-INSERT stock trigger with a phantom new id that double-counts the seller's own
    // current allocation, wrongly blocking valid edits.
    type Op = { kind: 'update' | 'insert' | 'delete'; seller_id: string; qty: number; delta: number }
    const ops: Op[] = []

    for (const s of sellers) {
      const current = cellFor(s.id).allocated
      const sold = cellFor(s.id).sold
      const raw = qtys[s.id]
      const next = raw === '' || raw === undefined ? 0 : Number(raw)

      if (next === current) continue                 // no change
      if (next === 0) {
        if (sold > 0) continue                        // never delete sold-from rows
        ops.push({ kind: 'delete', seller_id: s.id, qty: 0, delta: -current })
      } else if (current === 0) {
        ops.push({ kind: 'insert', seller_id: s.id, qty: next, delta: next })
      } else {
        ops.push({ kind: 'update', seller_id: s.id, qty: next, delta: next - current })
      }
    }

    if (!ops.length) {
      setError("Hech qanday o'zgarish yo'q"); setLoading(false); return
    }

    // Apply reductions before increases so a mix can't transiently exceed stock.
    ops.sort((a, b) => a.delta - b.delta)
    for (const op of ops) {
      const q = supabase.from('allocations')
      const err =
        op.kind === 'delete'
          ? (await q.delete().eq('seller_id', op.seller_id).eq('product_id', productId)).error
          : op.kind === 'update'
          ? (await q.update({ qty_allocated: op.qty }).eq('seller_id', op.seller_id).eq('product_id', productId)).error
          : (await q.insert({ seller_id: op.seller_id, product_id: productId, qty_allocated: op.qty })).error
      if (err) { setError(err.message); setLoading(false); return }
    }

    // Refresh cells client-side (no navigation)
    const { data: fresh } = await supabase.from('v_inventory')
      .select('seller_id, product_id, qty_allocated, qty_sold')
    if (fresh) {
      const map: Record<string, Cell> = {}
      for (const r of fresh) map[`${r.product_id}|${r.seller_id}`] = { allocated: r.qty_allocated, sold: r.qty_sold }
      setCells(map)
    }

    setLoading(false); setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
  }

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-6 max-w-2xl mx-auto">
        <h2 className="font-display font-bold text-ink text-2xl mb-6">Mahsulot taqsimlash</h2>

        <div className="bg-surface rounded-2xl shadow-card p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-muted mb-2">Mahsulot</label>
            <select
              value={productId}
              onChange={e => pickProduct(e.target.value)}
              className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition"
            >
              <option value="">Tanlang…</option>
              {products.map(p => {
                const alloc = sellers.reduce((n, s) => n + (cells[`${p.id}|${s.id}`]?.allocated ?? 0), 0)
                return <option key={p.id} value={p.id}>{p.name} — {p.total_qty - alloc} ta bo'sh</option>
              })}
            </select>
          </div>

          {selected && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Jami', value: selected.total_qty, color: 'bg-lavender/20 text-ink' },
                  { label: 'Taqsimlangan', value: totalAssigning, color: 'bg-peach/20 text-ink' },
                  { label: 'Qoldi', value: unallocated, color: unallocated < 0 ? 'bg-red-100 text-danger' : 'bg-mint/20 text-success' },
                ].map(s => (
                  <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
                    <p className="text-xs text-muted mb-1">{s.label}</p>
                    <p className="font-display font-bold text-xl">{s.value}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted -mt-1">
                Raqam — sotuvchidagi <b>yangi umumiy soni</b> (ustiga yoziladi). 0 qilsangiz — olib tashlanadi.
              </p>

              {overLimit && (
                <div className="rounded-xl px-4 py-3 text-sm font-semibold bg-red-50 text-danger">
                  {totalAssigning - selected.total_qty} ta oshib ketdi — jami {selected.total_qty} ta.
                </div>
              )}
              {belowSold.length > 0 && (
                <div className="rounded-xl px-4 py-3 text-sm font-semibold bg-red-50 text-danger space-y-1">
                  {belowSold.map(s => (
                    <div key={s.id}>{s.full_name}: {cellFor(s.id).sold} ta sotilgan — kamaytirib bo'lmaydi.</div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {sellers.map(s => {
                  const c = cellFor(s.id)
                  const bad = belowSold.some(b => b.id === s.id)
                  return (
                    <div key={s.id} className="flex items-center gap-4 bg-cream rounded-xl px-4 py-3">
                      <div className="flex-1">
                        <span className="font-medium text-ink">{s.full_name}</span>
                        <span className="text-xs text-muted ml-2">
                          hozir: {c.allocated} · sotildi: {c.sold}
                        </span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={qtys[s.id] ?? ''}
                        onChange={e => setQtys(q => ({ ...q, [s.id]: e.target.value }))}
                        placeholder="0"
                        className={`w-20 bg-surface text-ink text-right rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 border-2 transition ${bad ? 'border-danger ring-danger' : 'border-transparent focus:ring-rose'}`}
                      />
                    </div>
                  )
                })}
              </div>

              {error && <p className="text-danger text-sm">{error}</p>}
              {success && (
                <div className="flex items-center gap-2 text-success text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" /> Saqlandi!
                </div>
              )}

              <button
                onClick={save}
                disabled={loading || overLimit || belowSold.length > 0}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-4 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50"
              >
                <Share2 className="w-5 h-5" />
                {loading ? 'Saqlanmoqda…' : 'Saqlash'}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'admin')
  if (guard) return guard
  const supabase = createClient(ctx)

  const [{ data: products }, { data: sellers }, { data: inv }] = await Promise.all([
    supabase.from('products').select('id, name, total_qty').order('name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'seller').eq('active', true).order('full_name'),
    supabase.from('v_inventory').select('seller_id, product_id, qty_allocated, qty_sold'),
  ])

  const cells: Record<string, Cell> = {}
  for (const r of inv ?? []) {
    cells[`${r.product_id}|${r.seller_id}`] = { allocated: r.qty_allocated, sold: r.qty_sold }
  }

  return { props: { products: products ?? [], sellers: sellers ?? [], cells } }
}
