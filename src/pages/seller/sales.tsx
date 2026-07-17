import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS, formatDate } from '@/lib/format'
import { useState, useMemo } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import { useRouter } from 'next/router'
import { Trash2, Package, Search, TrendingUp, Pencil, Plus, Minus, RotateCcw } from 'lucide-react'
import SellerNav from '@/components/SellerNav'
import { S } from '@/consts/strings'

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
}

export default function MySales({ sales }: { sales: Sale[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [month, setMonth] = useState('all')
  const [search, setSearch] = useState('')

  // Inline edit (fix a mistyped quantity or price)
  const [editId, setEditId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState(1)
  const [editPrice, setEditPrice] = useState('')
  const [editError, setEditError] = useState('')

  function openEdit(sale: Sale) {
    setEditId(sale.id); setEditQty(Math.abs(sale.qty)); setEditPrice(String(sale.unit_price)); setEditError('')
  }
  async function saveEdit(sale: Sale) {
    const price = Number(editPrice)
    if (editQty < 1) { setEditError('Kamida 1 ta'); return }
    if (Number.isNaN(price) || price < 0) { setEditError("Narx noto'g'ri"); return }
    setBusy(sale.id); setEditError('')
    const supabase = createBrowser()
    const { error } = await supabase.from('sales').update({ qty: editQty, unit_price: price }).eq('id', sale.id)
    setBusy(null)
    if (error) { setEditError(error.message); return }   // e.g. oversell guard
    setEditId(null)
    router.replace(router.asPath)
  }

  // A return is stored as a sale with negative qty.
  async function returnSale(sale: Sale) {
    if (!confirm(`"${sale.product_name}" ni qaytarasizmi? Ombor va foyda qayta hisoblanadi.`)) return
    setBusy(sale.id)
    const supabase = createBrowser()
    const { data: orig } = await supabase.from('sales').select('seller_id, product_id, qty, unit_price').eq('id', sale.id).single()
    if (orig) {
      await supabase.from('sales').insert({
        seller_id: orig.seller_id, product_id: orig.product_id,
        qty: -Math.abs(orig.qty), unit_price: orig.unit_price, note: 'Qaytarildi',
      })
      router.replace(router.asPath)
    }
    setBusy(null)
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

  const totals = useMemo(() => ({
    units: filtered.reduce((n, s) => n + s.qty, 0),
    profit: filtered.reduce((n, s) => n + s.your_profit, 0),
    revenue: filtered.reduce((n, s) => n + s.amount, 0),
  }), [filtered])

  // Per-product summary
  const byProduct = useMemo(() => {
    const map: Record<string, { qty: number; profit: number; revenue: number }> = {}
    for (const s of filtered) {
      const a = map[s.product_name] ??= { qty: 0, profit: 0, revenue: 0 }
      a.qty += s.qty; a.profit += s.your_profit; a.revenue += s.amount
    }
    return Object.entries(map).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.qty - a.qty)
  }, [filtered])

  async function deleteSale(id: string) {
    if (!confirm(S.deleteConfirm)) return
    setBusy(id)
    const supabase = createBrowser()
    await supabase.from('sales').delete().eq('id', id)
    router.replace(router.asPath)
    setBusy(null)
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

            {/* Per-product summary */}
            {byProduct.length > 0 && (
              <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-display font-bold text-ink text-sm">Mahsulotlar bo'yicha</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted text-xs">
                      <th className="text-left px-4 py-2 font-semibold">Mahsulot</th>
                      <th className="text-right px-3 py-2 font-semibold">Sotildi</th>
                      <th className="text-right px-4 py-2 font-semibold">Foyda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byProduct.map((p, i) => (
                      <tr key={p.name} className={i % 2 === 1 ? 'bg-cream/50' : ''}>
                        <td className="px-4 py-2.5 font-medium text-ink">{p.name}</td>
                        <td className="px-3 py-2.5 text-right text-ink">{p.qty} ta</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-success">{formatUZS(p.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Individual sales */}
            <div>
              <p className="font-display font-bold text-ink text-sm mb-1 px-1">Har bir sotuv ({filtered.length})</p>
              <p className="text-xs text-muted mb-2 px-1">Xato yozdingizmi? <b className="text-rose">Tahrirlash</b> — sonini tuzatadi · <b className="text-warning">Qaytarish</b> — mijoz mahsulotni qaytarsa</p>
              {filtered.length === 0 ? (
                <div className="bg-surface rounded-2xl shadow-card p-8 text-center text-muted text-sm">Bu filtr bo'yicha sotuv yo'q</div>
              ) : (
                <div className="space-y-3">
                  {filtered.map(sale => {
                    const isReturn = sale.qty < 0
                    const isEditing = editId === sale.id
                    return (
                    <div key={sale.id} className={`rounded-2xl shadow-card p-4 ${isReturn ? 'bg-red-50' : 'bg-surface'}`}>
                      {isEditing ? (
                        <div className="space-y-3">
                          <p className="font-display font-semibold text-ink">{sale.product_name}</p>
                          {/* Quantity stepper (same feel as the add-sale form) */}
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted flex-1">Nechta sotildi?</span>
                            <button onClick={() => setEditQty(q => Math.max(1, q - 1))}
                              className="w-9 h-9 rounded-full bg-cream text-ink grid place-items-center active:scale-95 transition"><Minus className="w-4 h-4" /></button>
                            <span className="font-display font-bold text-xl w-8 text-center">{editQty}</span>
                            <button onClick={() => setEditQty(q => q + 1)}
                              className="w-9 h-9 rounded-full bg-gradient-to-br from-rose to-peach text-white grid place-items-center active:scale-95 transition shadow-rose"><Plus className="w-4 h-4" /></button>
                          </div>
                          {/* Unit price */}
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted flex-1">Dona narxi</span>
                            <input type="number" min={0} value={editPrice} onChange={e => setEditPrice(e.target.value)}
                              className="w-36 bg-cream text-ink text-right rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            <span className="text-sm text-muted">Jami</span>
                            <span className="font-display font-bold text-ink">{formatUZS(editQty * (Number(editPrice) || 0))}</span>
                          </div>
                          {editError && <p className="text-danger text-xs">{editError}</p>}
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(sale)} disabled={busy === sale.id}
                              className="flex-1 bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-2.5 rounded-full text-sm active:scale-95 transition disabled:opacity-50">
                              {busy === sale.id ? 'Saqlanmoqda…' : 'Saqlash'}
                            </button>
                            <button onClick={() => setEditId(null)} className="px-5 text-muted text-sm">Bekor</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-display font-semibold text-ink truncate">{sale.product_name}</p>
                                {isReturn && <span className="text-[10px] font-bold bg-danger text-white px-2 py-0.5 rounded-full flex-shrink-0">Qaytarilgan</span>}
                              </div>
                              <p className="text-sm text-muted mt-1">{Math.abs(sale.qty)} × {formatUZS(sale.unit_price)}</p>
                              <p className={`text-xs font-semibold mt-1 ${isReturn ? 'text-danger' : 'text-rose'}`}>
                                Foyda: {formatUZS(sale.your_profit)}
                              </p>
                              <p className="text-xs text-muted/60 mt-1">{formatDate(sale.sold_at, true)}</p>
                            </div>
                            <p className={`font-display font-bold text-lg flex-shrink-0 ${isReturn ? 'text-danger' : 'text-success'}`}>{formatUZS(sale.amount)}</p>
                          </div>
                          {/* Action bar */}
                          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
                            {!isReturn ? (
                              <>
                                <button onClick={() => openEdit(sale)} disabled={busy === sale.id}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-rose bg-rose/10 hover:bg-rose/20 px-3 py-2 rounded-full transition disabled:opacity-30">
                                  <Pencil className="w-3.5 h-3.5" /> Tahrirlash
                                </button>
                                <button onClick={() => returnSale(sale)} disabled={busy === sale.id}
                                  className="flex items-center gap-1.5 text-xs font-semibold text-warning bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-full transition disabled:opacity-30">
                                  <RotateCcw className="w-3.5 h-3.5" /> Qaytarish
                                </button>
                              </>
                            ) : <span className="text-xs text-muted">Qaytarilgan yozuv</span>}
                            <button onClick={() => deleteSale(sale.id)} disabled={busy === sale.id}
                              className="ml-auto text-danger/40 hover:text-danger transition disabled:opacity-30 p-2">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
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
  const { data: sales } = await supabase
    .from('v_my_sales')
    .select('id, product_name, qty, unit_price, amount, your_profit, sold_at')
    .order('sold_at', { ascending: false })
    .limit(300)

  return { props: { sales: sales ?? [] } }
}
