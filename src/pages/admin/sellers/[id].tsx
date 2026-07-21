import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS, formatDate } from '@/lib/format'
import { S } from '@/consts/strings'
import AdminNav from '@/components/AdminNav'
import Link from 'next/link'
import { useState } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import { ChevronLeft, DollarSign, TrendingUp, AlertCircle, CheckCircle2, Wallet, Package, Wrench, Plus } from 'lucide-react'

type Adjustment = { id: string; product_id: string; product_name: string; qty: number; reason: string; note: string | null; created_at: string }
const REASONS: { value: string; label: string }[] = [
  { value: 'damaged', label: 'Buzilgan' },
  { value: 'lost',    label: "Yo'qolgan" },
  { value: 'gift',    label: "Sovg'a" },
  { value: 'other',   label: 'Boshqa' },
]
const reasonLabel = (r: string) => REASONS.find(x => x.value === r)?.label ?? r

type SellerProduct = {
  product_id: string
  product_name: string
  had: number
  sold: number
  left: number
  revenue: number
  seller_profit: number
}

type Sale = {
  id: string
  product_name: string
  qty: number
  unit_price: number
  sold_at: string
}

type Summary = {
  totalRevenue: number
  theirProfit: number
  owed: number
  submitted: number
  balance: number
}

type Props = {
  sellerId: string
  sellerName: string
  summary: Summary
  products: SellerProduct[]
  sales: Sale[]
  adjustments: Adjustment[]
}

const cards = (s: Summary) => [
  { label: 'Umumiy savdo',   value: formatUZS(s.totalRevenue), icon: DollarSign,  bg: 'bg-gradient-to-br from-rose to-roseDark' },
  { label: 'Daromadi',       value: formatUZS(s.theirProfit),  icon: TrendingUp,  bg: 'bg-gradient-to-br from-mint to-success' },
  { label: S.moneyCollect,   value: formatUZS(s.owed),         icon: AlertCircle, bg: 'bg-gradient-to-br from-peach to-warning' },
  { label: S.moneyHandedOver,value: formatUZS(s.submitted),    icon: CheckCircle2,bg: 'bg-gradient-to-br from-sky to-lavender' },
  { label: 'Qoldiq qarz',    value: formatUZS(s.balance),      icon: Wallet,      bg: s.balance > 0 ? 'bg-gradient-to-br from-danger to-rose' : 'bg-gradient-to-br from-success to-mint' },
]

export default function SellerDetail({ sellerId, sellerName, summary, products, sales, adjustments: initialAdjustments }: Props) {
  // G2 — update in place, reconcile in the background.
  const [adjustments, setAdjustments] = useState<Adjustment[]>(initialAdjustments)
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('damaged')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function addAdjustment(e: React.FormEvent) {
    e.preventDefault()
    const n = Number(qty)
    if (!productId || n <= 0) { setError("Mahsulot va soni to'g'ri bo'lsin"); return }
    setSaving(true); setError('')
    const supabase = createBrowser()
    const { error: err } = await supabase.from('stock_adjustments').insert({
      seller_id: sellerId, product_id: productId, qty: n, reason, note: note || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setProductId(''); setQty(''); setNote(''); setReason('damaged')
    const { data } = await supabase.from('stock_adjustments')
      .select('id, product_id, qty, reason, note, created_at')
      .eq('seller_id', sellerId).order('created_at', { ascending: false })
    if (data) {
      const nameOf: Record<string, string> = Object.fromEntries(products.map(p => [p.product_id, p.product_name]))
      setAdjustments((data as any[]).map(a => ({ ...a, product_name: nameOf[a.product_id] ?? '—' })))
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Back + title */}
        <div>
          <Link href="/admin/sellers" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-rose transition mb-3">
            <ChevronLeft className="w-4 h-4" /> Sotuvchilar
          </Link>
          <h2 className="font-display font-bold text-ink text-2xl">{sellerName}</h2>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {cards(summary).map(c => {
            const Icon = c.icon
            return (
              <div key={c.label} className={`${c.bg} text-white rounded-2xl p-5 shadow-card`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium opacity-80">{c.label}</p>
                  <Icon className="w-4 h-4 opacity-70" />
                </div>
                <p className="font-display text-xl font-bold leading-tight">{c.value}</p>
              </div>
            )
          })}
        </div>

        {/* Per-product table */}
        <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-rose" />
            <h3 className="font-display font-bold text-ink text-lg">Mahsulotlar bo'yicha</h3>
          </div>
          {products.length === 0 ? (
            <p className="text-muted text-sm px-6 py-8 text-center">Mahsulot biriktirilmagan</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 font-semibold text-muted">Mahsulot</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted">Bergan</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted">Sotgan</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted">Qolgan</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted">Savdo</th>
                    <th className="text-right px-6 py-3 font-semibold text-muted">Foyda</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.product_id} className={`${i % 2 === 1 ? 'bg-cream/50' : ''} hover:bg-rose/5 transition`}>
                      <td className="px-6 py-3 font-medium text-ink">{p.product_name}</td>
                      <td className="px-4 py-3 text-right text-ink">{p.had}</td>
                      <td className="px-4 py-3 text-right text-success font-semibold">{p.sold}</td>
                      <td className="px-4 py-3 text-right text-ink">{p.left}</td>
                      <td className="px-4 py-3 text-right text-ink">{formatUZS(p.revenue)}</td>
                      <td className="px-6 py-3 text-right font-display font-bold text-rose">{formatUZS(p.seller_profit)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-100 bg-cream/60">
                    <td className="px-6 py-3 font-display font-bold text-ink">Jami</td>
                    <td className="px-4 py-3 text-right font-bold text-ink">{products.reduce((a, p) => a + p.had, 0)}</td>
                    <td className="px-4 py-3 text-right font-bold text-success">{products.reduce((a, p) => a + p.sold, 0)}</td>
                    <td className="px-4 py-3 text-right font-bold text-ink">{products.reduce((a, p) => a + p.left, 0)}</td>
                    <td className="px-4 py-3 text-right font-bold text-ink">{formatUZS(summary.totalRevenue)}</td>
                    <td className="px-6 py-3 text-right font-display font-bold text-rose">{formatUZS(summary.theirProfit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Individual sales */}
        <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-display font-bold text-ink text-lg">So'nggi sotuvlar</h3>
          </div>
          {sales.length === 0 ? (
            <p className="text-muted text-sm px-6 py-8 text-center">Hali sotuv yo'q</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 font-semibold text-muted">Sana</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted">Mahsulot</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted">Soni</th>
                    <th className="text-right px-6 py-3 font-semibold text-muted">Narxi</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s, i) => (
                    <tr key={s.id} className={`${i % 2 === 1 ? 'bg-cream/50' : ''}`}>
                      <td className="px-6 py-3 text-muted">{formatDate(s.sold_at)}</td>
                      <td className="px-4 py-3 font-medium text-ink">{s.product_name}</td>
                      <td className="px-4 py-3 text-right text-ink">{s.qty}</td>
                      <td className="px-6 py-3 text-right text-ink">{formatUZS(s.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stock adjustments — damaged / lost / gifted */}
        <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-rose" />
            <h3 className="font-display font-bold text-ink text-lg">Ombor tuzatish</h3>
          </div>

          <form onSubmit={addAdjustment} className="p-6 grid gap-3 sm:grid-cols-5 items-end border-b border-gray-100">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-muted mb-1">Mahsulot</label>
              <select value={productId} onChange={e => setProductId(e.target.value)} required
                className="w-full bg-cream text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition">
                <option value="">Tanlang…</option>
                {products.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name} (qoldi: {p.left})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Soni</label>
              <input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)} required placeholder="0"
                className="w-full bg-cream text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Sabab</label>
              <select value={reason} onChange={e => setReason(e.target.value)}
                className="w-full bg-cream text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition">
                {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button type="submit" disabled={saving}
              className="flex items-center justify-center gap-1.5 bg-gradient-to-br from-rose to-peach text-white font-semibold px-4 py-2.5 rounded-xl shadow-rose active:scale-95 transition disabled:opacity-50 text-sm">
              <Plus className="w-4 h-4" /> {saving ? 'Saqlanmoqda…' : "Qo'shish"}
            </button>
            <div className="sm:col-span-5">
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Izoh (ixtiyoriy)"
                className="w-full bg-cream text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
              {error && <p className="text-danger text-xs mt-2">{error}</p>}
            </div>
          </form>

          {adjustments.length === 0 ? (
            <p className="text-muted text-sm px-6 py-6 text-center">Tuzatishlar yo'q</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 font-semibold text-muted">Sana</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted">Mahsulot</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted">Sabab</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted">Izoh</th>
                    <th className="text-right px-6 py-3 font-semibold text-muted">Soni</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((a, i) => (
                    <tr key={a.id} className={i % 2 === 1 ? 'bg-cream/50' : ''}>
                      <td className="px-6 py-3 text-muted">{formatDate(a.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-ink">{a.product_name}</td>
                      <td className="px-4 py-3"><span className="text-xs font-semibold bg-red-50 text-danger px-2 py-0.5 rounded-full">{reasonLabel(a.reason)}</span></td>
                      <td className="px-4 py-3 text-muted">{a.note ?? '—'}</td>
                      <td className="px-6 py-3 text-right font-display font-bold text-danger">−{a.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'admin')
  if (guard) return guard

  const id = ctx.params?.id as string
  const supabase = createClient(ctx)

  // Name + balances + sales list in parallel
  const [profileRes, balanceRes, salesRes] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', id).single(),
    supabase.from('v_seller_balances').select('*').eq('seller_id', id).maybeSingle(),
    supabase.from('v_sales_enriched').select('id, product_name, qty, unit_price, sold_at').eq('seller_id', id).order('sold_at', { ascending: false }).limit(100),
  ])

  if (!profileRes.data) return { notFound: true }

  // Per-product: prefer v_admin_seller_products, fall back to v_inventory + sales aggregation
  let products: SellerProduct[] = []
  const viewRes = await supabase.from('v_admin_seller_products').select('*').eq('seller_id', id).order('product_name')

  if (!viewRes.error && viewRes.data) {
    // Normalize: the installed view may name the "left" column `remaining`.
    products = (viewRes.data as Record<string, any>[]).map(r => ({
      product_id:    r.product_id,
      product_name:  r.product_name,
      had:           r.had ?? 0,
      sold:          r.sold ?? 0,
      left:          r.left ?? r.remaining ?? 0,
      revenue:       r.revenue ?? 0,
      seller_profit: r.seller_profit ?? 0,
    }))
  } else {
    const [invRes, aggRes] = await Promise.all([
      supabase.from('v_inventory').select('product_id, product_name, qty_allocated, qty_sold, qty_remaining').eq('seller_id', id).order('product_name'),
      supabase.from('v_sales_enriched').select('product_id, revenue, seller_profit').eq('seller_id', id),
    ])
    const agg: Record<string, { revenue: number; seller_profit: number }> = {}
    for (const r of aggRes.data ?? []) {
      if (!agg[r.product_id]) agg[r.product_id] = { revenue: 0, seller_profit: 0 }
      agg[r.product_id].revenue += r.revenue
      agg[r.product_id].seller_profit += r.seller_profit
    }
    products = (invRes.data ?? []).map(r => ({
      product_id:    r.product_id,
      product_name:  r.product_name,
      had:           r.qty_allocated,
      sold:          r.qty_sold,
      left:          r.qty_remaining,
      revenue:       agg[r.product_id]?.revenue ?? 0,
      seller_profit: agg[r.product_id]?.seller_profit ?? 0,
    }))
  }

  const summary: Summary = {
    totalRevenue: products.reduce((a, p) => a + p.revenue, 0),
    theirProfit:  products.reduce((a, p) => a + p.seller_profit, 0),
    owed:         balanceRes.data?.total_owed ?? 0,
    submitted:    balanceRes.data?.received ?? 0,
    balance:      balanceRes.data?.balance ?? 0,
  }

  // Stock adjustments for this seller (may be empty / table may not exist yet)
  const prodName: Record<string, string> = Object.fromEntries(products.map(p => [p.product_id, p.product_name]))
  const adjRes = await supabase.from('stock_adjustments').select('id, product_id, qty, reason, note, created_at').eq('seller_id', id).order('created_at', { ascending: false })
  const adjustments: Adjustment[] = (adjRes.data ?? []).map((a: any) => ({
    id: a.id, product_id: a.product_id, product_name: prodName[a.product_id] ?? '—',
    qty: a.qty, reason: a.reason, note: a.note, created_at: a.created_at,
  }))

  return {
    props: {
      sellerId: id,
      sellerName: balanceRes.data?.seller_name ?? profileRes.data.full_name,
      summary,
      products,
      sales: salesRes.data ?? [],
      adjustments,
    },
  }
}
