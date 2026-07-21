import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS, formatDate } from '@/lib/format'
import { useState, useMemo, useEffect } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import { Trash2, Package, Search, TrendingUp, Pencil, Plus, Minus, X, ChevronDown } from 'lucide-react'
import SellerNav from '@/components/SellerNav'
import { S } from '@/consts/strings'

const GRADIENTS = ['from-rose to-peach', 'from-lavender to-sky', 'from-mint to-sky', 'from-peach to-rose']
function Thumb({ name, url, i, className = '' }: { name: string; url?: string | null; i: number; className?: string }) {
  if (url) return <img src={url} alt={name} className={`object-cover ${className}`} />
  return (
    <div className={`bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} grid place-items-center ${className}`}>
      <span className="font-display font-bold text-white/80 text-lg">{name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

const UZ_MONTH = ['', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr']
function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return `${UZ_MONTH[parseInt(m, 10)] ?? m} ${y}`
}

// v_my_sales columns: id, product_name, qty, unit_price, amount, your_profit, sold_at
type Sale = {
  id: string
  product_name: string
  qty: number
  unit_price: number
  amount: number
  your_profit: number
  sold_at: string
  cancelled_at?: string | null
  cancel_reason?: string | null
}

// Why she cancelled — two chips cover almost everything (redesign.md §4.3).
const CANCEL_REASONS = ['Mijoz qaytardi', "Xato yozdim"]

type Props = {
  sales: Sale[]
  pricePending: string[]
  productBySale: Record<string, string>              // sale.id → product_id
  imageByProduct: Record<string, string | null>      // product_id → photo
  sellerId: string
  canCancel: boolean
}

export default function MySales({ sales: initialSales, pricePending, productBySale, imageByProduct, sellerId, canCancel }: Props) {
  // G2 — one refresh model: every write updates local state immediately, then
  // reconciles against the view in the background. No SSR round-trip on a tap.
  const [sales, setSales] = useState<Sale[]>(initialSales)
  const [busy, setBusy] = useState<string | null>(null)
  const [month, setMonth] = useState('all')
  const [search, setSearch] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [pending, setPending] = useState<string[]>(pricePending)
  const pricePendingSet = new Set(pending)

  // Pull the authoritative rows back (profit is computed by the view, never here).
  async function reconcile() {
    const supabase = createBrowser()
    const [{ data: fresh }, { data: reqs }] = await Promise.all([
      supabase.from('v_my_sales')
        .select(canCancel
          ? 'id, product_name, qty, unit_price, amount, your_profit, sold_at, cancelled_at, cancel_reason'
          : 'id, product_name, qty, unit_price, amount, your_profit, sold_at')
        .order('sold_at', { ascending: false }).limit(300),
      supabase.from('v_my_price_requests').select('sale_id, status'),
    ])
    if (fresh) setSales(fresh as unknown as Sale[])
    if (reqs) setPending((reqs as any[]).filter(r => r.status === 'pending').map(r => r.sale_id))
  }

  // G4 — every correction she makes leaves a row the admin can see. Fire-and-forget:
  // an audit failure must never block the correction itself.
  function logEdit(saleId: string, action: 'qty' | 'price' | 'cancel' | 'restore',
                   oldValue: number | null, newValue: number | null, reason?: string) {
    const supabase = createBrowser()
    supabase.from('sale_edits').insert({
      sale_id: saleId, editor_id: sellerId, action,
      old_value: oldValue, new_value: newValue, reason: reason ?? null,
    }).then(() => {}, () => {})
  }

  // Cancel instead of delete (G4). The row survives, greyed, and every aggregate view
  // filters it out — so revenue, profit, debt and stock all correct themselves.
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0])

  async function doCancel(sale: Sale) {
    setBusy(sale.id)
    const supabase = createBrowser()
    const { error } = await supabase.from('sales')
      .update({ cancelled_at: new Date().toISOString(), cancel_reason: cancelReason })
      .eq('id', sale.id)
    setBusy(null)
    if (error) { setEditError(error.message); return }
    logEdit(sale.id, 'cancel', Math.abs(sale.qty), 0, cancelReason)
    setSales(list => list.map(x => x.id === sale.id
      ? { ...x, cancelled_at: new Date().toISOString(), cancel_reason: cancelReason } : x))
    setCancelId(null)
    reconcile()
  }

  async function doRestore(sale: Sale) {
    setBusy(sale.id)
    const supabase = createBrowser()
    const { error } = await supabase.from('sales')
      .update({ cancelled_at: null, cancel_reason: null }).eq('id', sale.id)
    setBusy(null)
    if (error) { setEditError(error.message); return }
    logEdit(sale.id, 'restore', 0, Math.abs(sale.qty))
    setSales(list => list.map(x => x.id === sale.id ? { ...x, cancelled_at: null, cancel_reason: null } : x))
    reconcile()
  }

  // Inline edit — quantity (son) is changed directly; price goes through an admin request.
  const [editId, setEditId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState(1)
  const [editError, setEditError] = useState('')

  // Price-change request (needs admin approval, unlike qty)
  const [priceOpen, setPriceOpen] = useState(false)
  const [priceValue, setPriceValue] = useState('')
  const [priceReason, setPriceReason] = useState('')
  const [priceBusy, setPriceBusy] = useState(false)
  const [priceErr, setPriceErr] = useState('')
  const [priceDone, setPriceDone] = useState(false)

  function openEdit(sale: Sale) {
    setEditId(sale.id); setEditQty(Math.abs(sale.qty)); setEditError('')
    setPriceOpen(false); setPriceValue(String(sale.unit_price)); setPriceReason(''); setPriceErr(''); setPriceDone(false)
  }
  async function saveEdit(sale: Sale) {
    if (editQty < 1) { setEditError('Kamida 1 ta'); return }
    setBusy(sale.id); setEditError('')
    const supabase = createBrowser()
    const { error } = await supabase.from('sales').update({ qty: editQty }).eq('id', sale.id)
    setBusy(null)
    if (error) { setEditError(error.message); return }   // e.g. oversell guard
    logEdit(sale.id, 'qty', Math.abs(sale.qty), editQty)
    // Optimistic: scale amount/profit linearly, then let reconcile() correct them.
    const factor = editQty / Math.abs(sale.qty || 1)
    setSales(list => list.map(s => s.id === sale.id
      ? { ...s, qty: editQty, amount: s.unit_price * editQty, your_profit: s.your_profit * factor }
      : s))
    setEditId(null)
    reconcile()
  }
  // G4 — she corrects her OWN sale's price directly. RLS already permitted this
  // (sales_update covers seller_id = my_profile_id()); only the UI was gating it.
  // The audit row is what makes it safe: the admin sees every change.
  const [priceSaving, setPriceSaving] = useState(false)
  async function savePriceDirect(sale: Sale) {
    const price = Number(priceValue)
    if (priceValue === '' || Number.isNaN(price) || price < 0) { setPriceErr("Narx noto'g'ri"); return }
    setPriceSaving(true); setPriceErr('')
    const supabase = createBrowser()
    const { error } = await supabase.from('sales').update({ unit_price: price }).eq('id', sale.id)
    setPriceSaving(false)
    if (error) { setPriceErr(error.message); return }
    logEdit(sale.id, 'price', sale.unit_price, price, priceReason || undefined)
    setSales(list => list.map(x => x.id === sale.id
      ? { ...x, unit_price: price, amount: price * Math.abs(x.qty) } : x))
    setPriceOpen(false); setEditId(null)
    reconcile()
  }

  async function submitPriceRequest(sale: Sale) {
    const price = Number(priceValue)
    if (priceValue === '' || Number.isNaN(price) || price < 0) { setPriceErr("Narx noto'g'ri"); return }
    setPriceBusy(true); setPriceErr('')
    const res = await fetch('/api/sale-price-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: sale.id, requested_price: price, reason: priceReason }),
    })
    const json = await res.json().catch(() => ({}))
    setPriceBusy(false)
    if (!res.ok) { setPriceErr(json.error ?? 'Xatolik'); return }
    setPriceDone(true)
    setPending(p => [...p, sale.id])   // show "so'rov yuborildi" straight away
    reconcile()
  }

  // Distinct months present, newest first
  const months = useMemo(() => {
    const set = new Set(sales.map(s => s.sold_at.slice(0, 7)))
    return Array.from(set).sort().reverse()
  }, [sales])

  const filtered = useMemo(() => sales.filter(s => {
    const okMonth = month === 'all' || s.sold_at.slice(0, 7) === month
    const okSearch = !search.trim() || s.product_name.toLowerCase().includes(search.trim().toLowerCase())
    return okMonth && okSearch
  }), [sales, month, search])

  // Cancelled rows stay visible but must never be counted.
  const counted = useMemo(() => filtered.filter(s => !s.cancelled_at), [filtered])

  const totals = useMemo(() => ({
    units: counted.reduce((n, s) => n + s.qty, 0),
    profit: counted.reduce((n, s) => n + s.your_profit, 0),
    revenue: counted.reduce((n, s) => n + s.amount, 0),
  }), [counted])

  // ── One card per product ────────────────────────────────────────────────
  // The card header IS the summary that used to live in a separate table, so a sale
  // is read and fixed in the same place. Grouped by product_id (never by name — G7),
  // so renaming a product never splits its history in two.
  const groups = useMemo(() => {
    type Group = {
      key: string; name: string; image: string | null
      sales: Sale[]; qty: number; revenue: number; profit: number
      cancelledCount: number; lastSoldAt: string
    }
    const map: Record<string, Group> = {}
    for (const sale of filtered) {
      const key = productBySale[sale.id] ?? `name:${sale.product_name}`
      const g = map[key] ??= {
        key, name: sale.product_name, image: imageByProduct[productBySale[sale.id]] ?? null,
        sales: [], qty: 0, revenue: 0, profit: 0, cancelledCount: 0, lastSoldAt: sale.sold_at,
      }
      g.sales.push(sale)
      if (sale.cancelled_at) g.cancelledCount++
      else { g.qty += sale.qty; g.revenue += sale.amount; g.profit += sale.your_profit }
      if (sale.sold_at > g.lastSoldAt) g.lastSoldAt = sale.sold_at
    }
    // Most recently sold first — that's the one she's most likely correcting.
    return Object.values(map)
      .map(g => ({ ...g, sales: g.sales.sort((a, b) => (a.sold_at < b.sold_at ? 1 : -1)) }))
      .sort((a, b) => (a.lastSoldAt < b.lastSoldAt ? 1 : -1))
  }, [filtered, productBySale, imageByProduct])

  // Closed by default; the newest product opens itself. Narrowing the filter to a
  // single product opens that one, so searching lands her straight on the sale.
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (groups.length === 1) { setOpenKey(groups[0].key); return }
    if (!touched && groups.length > 0) setOpenKey(groups[0].key)
  }, [groups, touched]) // eslint-disable-line react-hooks/exhaustive-deps
  function toggle(key: string) {
    setTouched(true)
    setOpenKey(k => (k === key ? null : key))
  }

  // Delete uses a friendly inline confirm card (not a scary native popup).
  async function doDelete(id: string) {
    setBusy(id)
    const supabase = createBrowser()
    await supabase.from('sales').delete().eq('id', id)
    setSales(list => list.filter(s => s.id !== id))   // optimistic
    setConfirmDeleteId(null)
    setBusy(null)
    reconcile()
  }

  return (
    <div className="min-h-screen bg-cream pb-28">
      <header className="bg-gradient-to-br from-rose to-peach text-white px-5 pt-10 pb-14 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/4" />
        <h1 className="font-display text-2xl font-bold relative">{S.mySales}</h1>
      </header>

      <main className="px-4 -mt-6 relative z-10 space-y-4">

        {sales.length === 0 ? (
          <div className="bg-surface rounded-2xl shadow-card p-10 text-center text-muted">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{S.noSales}</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface rounded-2xl shadow-card p-4">
                <p className="text-xs text-muted mb-1">Sotilgan ({totals.units} ta)</p>
                <p className="font-display text-xl font-bold text-ink">{formatUZS(totals.revenue)}</p>
              </div>
              <div className="bg-gradient-to-br from-success to-mint text-white rounded-2xl shadow-card p-4">
                <p className="text-xs opacity-90 mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Foyda</p>
                <p className="font-display text-xl font-bold">{formatUZS(totals.profit)}</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mahsulot qidirish…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface text-ink text-sm shadow-card border-2 border-transparent focus:outline-none focus:border-rose transition" />
              </div>
              <select value={month} onChange={e => setMonth(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-surface text-ink text-sm shadow-card border-2 border-transparent focus:outline-none focus:border-rose transition">
                <option value="all">Barcha oylar</option>
                {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </div>

            {/* ── One card per product: header = the summary, inside = the sales ── */}
            {groups.length === 0 ? (
              <div className="bg-surface rounded-2xl shadow-card p-8 text-center text-muted text-sm">
                Bu filtr bo'yicha sotuv yo'q
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((g, gi) => {
                  const open = openKey === g.key
                  return (
                    <div key={g.key} className="bg-surface rounded-2xl shadow-card overflow-hidden">

                      {/* Header — one big tap target */}
                      <button onClick={() => toggle(g.key)} className="w-full flex items-center gap-3 p-3 text-left active:bg-cream/60 transition">
                        <Thumb name={g.name} url={g.image} i={gi} className="w-20 h-20 rounded-2xl flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-semibold text-ink text-sm leading-snug line-clamp-2">{g.name}</p>
                          {/* The number she is checking, right beside the photo */}
                          <p className="font-display font-bold text-ink text-lg leading-tight mt-0.5">
                            {g.qty} ta <span className="text-muted font-sans font-medium text-xs">sotildi</span>
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {formatUZS(g.revenue)} · <span className="text-success font-semibold">Foyda {formatUZS(g.profit)}</span>
                          </p>
                          {g.cancelledCount > 0 && (
                            <p className="text-[11px] text-muted/70 mt-0.5">{g.cancelledCount} ta bekor qilingan</p>
                          )}
                        </div>
                        <ChevronDown className={`w-5 h-5 text-muted flex-shrink-0 transition ${open ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Sales inside this product */}
                      {open && (
                        <div className="border-t border-gray-100 divide-y divide-gray-100">
                          {g.sales.map(sale => {
                            const isReturn = sale.qty < 0
                            const isEditing = editId === sale.id
                            const isCancelled = !!sale.cancelled_at
                            return (
                              <div key={sale.id} className={`p-3 ${isCancelled ? 'bg-gray-50' : isReturn ? 'bg-red-50' : ''}`}>
                                {isEditing ? (
                                  <div className="space-y-3">
                                    {/* Quantity stepper */}
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm text-muted flex-1">Nechta sotildi?</span>
                                      <button aria-label="Kamaytirish" onClick={() => setEditQty(q => Math.max(1, q - 1))}
                                        className="w-9 h-9 rounded-full bg-cream text-ink grid place-items-center active:scale-95 transition"><Minus className="w-4 h-4" /></button>
                                      <span className="font-display font-bold text-xl w-8 text-center">{editQty}</span>
                                      <button aria-label="Ko'paytirish" onClick={() => setEditQty(q => q + 1)}
                                        className="w-9 h-9 rounded-full bg-gradient-to-br from-rose to-peach text-white grid place-items-center active:scale-95 transition shadow-rose"><Plus className="w-4 h-4" /></button>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm text-muted">Jami ({formatUZS(sale.unit_price)} × {editQty})</span>
                                      <span className="font-display font-bold text-ink">{formatUZS(editQty * sale.unit_price)}</span>
                                    </div>
                                    {editError && <p className="text-danger text-xs">{editError}</p>}
                                    <div className="flex gap-2">
                                      <button onClick={() => saveEdit(sale)} disabled={busy === sale.id}
                                        className="flex-1 bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-2.5 rounded-full text-sm active:scale-95 transition disabled:opacity-50">
                                        {busy === sale.id ? 'Saqlanmoqda…' : 'Saqlash'}
                                      </button>
                                      <button onClick={() => setEditId(null)} className="px-5 text-muted text-sm">Bekor</button>
                                    </div>

                                    {/* Price correction — direct, audited */}
                                    <div className="pt-3 border-t border-black/5">
                                      {pricePendingSet.has(sale.id) ? (
                                        <p className="text-xs font-semibold text-warning">💵 Narx so'rovi yuborildi — admin javobini kuting</p>
                                      ) : priceOpen ? (
                                        <div className="space-y-2">
                                          <p className="text-xs font-semibold text-ink">To'g'ri dona narxini yozing:</p>
                                          <div className="flex items-center gap-2">
                                            <input type="number" min={0} value={priceValue} onChange={e => setPriceValue(e.target.value)}
                                              className="w-28 bg-cream text-ink text-right rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                                            <input value={priceReason} onChange={e => setPriceReason(e.target.value)} placeholder="Sabab (ixtiyoriy)…"
                                              className="flex-1 bg-cream text-ink rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                                          </div>
                                          {priceErr && <p className="text-danger text-xs">{priceErr}</p>}
                                          <div className="flex gap-2">
                                            <button disabled={priceSaving} onClick={() => savePriceDirect(sale)}
                                              className="flex-1 bg-rose text-white text-xs font-semibold py-2 rounded-lg disabled:opacity-50">
                                              {priceSaving ? 'Saqlanmoqda…' : 'Narxni saqlash'}
                                            </button>
                                            <button aria-label="Yopish" onClick={() => setPriceOpen(false)} className="px-3 text-muted"><X className="w-4 h-4" /></button>
                                          </div>
                                          <p className="text-[11px] text-muted leading-snug">O'zgarish darhol saqlanadi va admin ko'radi.</p>
                                        </div>
                                      ) : (
                                        <button onClick={() => setPriceOpen(true)}
                                          className="text-xs font-semibold text-rose">💵 Narx noto'g'rimi? Tuzatish</button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-3">
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${isCancelled ? 'text-muted line-through' : 'text-ink'}`}>
                                          {Math.abs(sale.qty)} ta × {formatUZS(sale.unit_price)}
                                        </p>
                                        <p className="text-xs text-muted/70 mt-0.5">{formatDate(sale.sold_at, true)}</p>
                                        {!isCancelled && (
                                          <p className={`text-xs font-semibold mt-0.5 ${isReturn ? 'text-danger' : 'text-rose'}`}>
                                            Foyda: {formatUZS(sale.your_profit)}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <p className={`font-display font-bold ${isCancelled ? 'text-muted line-through' : isReturn ? 'text-danger' : 'text-success'}`}>
                                          {formatUZS(sale.amount)}
                                        </p>
                                        {isCancelled && <span className="text-[10px] font-bold bg-gray-200 text-muted px-2 py-0.5 rounded-full">Bekor qilingan</span>}
                                        {isReturn && !isCancelled && <span className="text-[10px] font-bold bg-danger text-white px-2 py-0.5 rounded-full">Qaytarilgan</span>}
                                      </div>
                                    </div>

                                    {isCancelled ? (
                                      <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs text-muted flex-1">
                                          {sale.cancel_reason ? `Sabab: ${sale.cancel_reason}` : 'Bekor qilingan'}
                                        </span>
                                        <button onClick={() => doRestore(sale)} disabled={busy === sale.id}
                                          className="text-xs font-semibold text-success bg-green-50 px-3 py-1.5 rounded-full disabled:opacity-50">
                                          Qaytarish
                                        </button>
                                      </div>
                                    ) : cancelId === sale.id ? (
                                      <div className="mt-2">
                                        <p className="text-sm text-ink mb-2 leading-snug">Nima uchun bekor qilinmoqda?</p>
                                        <div className="flex gap-2 mb-3">
                                          {CANCEL_REASONS.map(r => (
                                            <button key={r} onClick={() => setCancelReason(r)}
                                              className={`flex-1 text-xs font-semibold py-2 rounded-full transition ${cancelReason === r ? 'bg-gradient-to-br from-rose to-peach text-white' : 'bg-cream text-ink'}`}>
                                              {r}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex gap-2">
                                          <button onClick={() => setCancelId(null)}
                                            className="flex-1 bg-cream text-ink text-sm font-semibold py-2.5 rounded-full active:scale-95 transition">Yopish</button>
                                          <button onClick={() => doCancel(sale)} disabled={busy === sale.id}
                                            className="flex-1 bg-danger text-white text-sm font-semibold py-2.5 rounded-full active:scale-95 transition disabled:opacity-50">
                                            {busy === sale.id ? '…' : 'Ha, bekor qilish'}
                                          </button>
                                        </div>
                                        <p className="text-[11px] text-muted mt-2 leading-snug">
                                          Yozuv o'chmaydi — hisobdan chiqariladi, keyin qaytarish mumkin.
                                        </p>
                                      </div>
                                    ) : confirmDeleteId === sale.id ? (
                                      <div className="mt-2">
                                        <p className="text-sm text-ink mb-2 leading-snug">{S.deleteConfirm}</p>
                                        <div className="flex gap-2">
                                          <button onClick={() => setConfirmDeleteId(null)}
                                            className="flex-1 bg-cream text-ink text-sm font-semibold py-2.5 rounded-full active:scale-95 transition">Bekor qilish</button>
                                          <button onClick={() => doDelete(sale.id)} disabled={busy === sale.id}
                                            className="flex-1 bg-danger text-white text-sm font-semibold py-2.5 rounded-full active:scale-95 transition disabled:opacity-50">Ha, o'chirish</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 mt-2">
                                        {!isReturn ? (
                                          <button onClick={() => openEdit(sale)} disabled={busy === sale.id}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-rose bg-rose/10 hover:bg-rose/20 px-3 py-2 rounded-full transition disabled:opacity-30">
                                            <Pencil className="w-3.5 h-3.5" /> Tahrirlash
                                          </button>
                                        ) : <span className="text-xs text-muted">Qaytarilgan yozuv</span>}
                                        {canCancel ? (
                                          <button onClick={() => { setCancelId(sale.id); setCancelReason(CANCEL_REASONS[0]) }}
                                            disabled={busy === sale.id}
                                            className="ml-auto text-xs font-semibold text-muted hover:text-danger transition disabled:opacity-30 px-3 py-2">
                                            Bekor qilish
                                          </button>
                                        ) : (
                                          <button aria-label="Sotuvni o'chirish" onClick={() => setConfirmDeleteId(sale.id)} disabled={busy === sale.id}
                                            className="ml-auto text-danger/40 hover:text-danger transition disabled:opacity-30 p-2">
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </main>

      <SellerNav />
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'seller')
  if (guard) return guard

  const supabase = createClient(ctx)
  // v_my_sales exposes `amount` (revenue) + `your_profit`; there is no `revenue`/`note` column.
  // Capability probe: `cancelled_at` only appears on v_my_sales once
  // docs/sale-cancellation-views.md has been run — which is also exactly when the
  // aggregate views start excluding cancelled rows. So one column tells us whether
  // cancelling is SAFE. Until then the page keeps the old delete behaviour.
  const probe = await supabase.from('v_my_sales').select('id, cancelled_at').limit(1)
  const canCancel = !probe.error

  const SALE_COLS = canCancel
    ? 'id, product_name, qty, unit_price, amount, your_profit, sold_at, cancelled_at, cancel_reason'
    : 'id, product_name, qty, unit_price, amount, your_profit, sold_at'

  const [{ data: sales }, { data: priceReqs }, { data: catalog }, { data: saleRows }] = await Promise.all([
    supabase.from('v_my_sales')
      .select(SALE_COLS)
      .order('sold_at', { ascending: false }).limit(300),
    supabase.from('v_my_price_requests').select('sale_id, status'),
    supabase.from('v_catalog').select('id, image_url'),
    // v_my_sales has no product_id — take it from the base table (RLS: own rows only)
    // so photos key on the ID, not the name. Renaming a product keeps its history (G7).
    supabase.from('sales').select('id, product_id'),
  ])

  const pricePending = (priceReqs ?? []).filter(r => r.status === 'pending').map(r => r.sale_id)

  // Product identity per sale, so the page can GROUP by product_id rather than by
  // name (G7): renaming a product never splits its history into two cards.
  const imageByProduct: Record<string, string | null> = {}
  for (const c of catalog ?? []) imageByProduct[(c as any).id] = (c as any).image_url ?? null

  const productBySale: Record<string, string> = {}
  for (const s of saleRows ?? []) productBySale[(s as any).id] = (s as any).product_id

  const { data: { session } } = await supabase.auth.getSession()
  const { data: profile } = await supabase
    .from('profiles').select('id').eq('user_id', session!.user.id).single()

  return { props: { sales: sales ?? [], pricePending, productBySale, imageByProduct, sellerId: profile?.id ?? '', canCancel } }
}
