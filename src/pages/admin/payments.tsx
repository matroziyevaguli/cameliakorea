import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS, formatDate } from '@/lib/format'
import { useState } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import AdminNav from '@/components/AdminNav'
import { CheckCircle, PlusCircle, History, Trash2, TrendingUp, Wallet, HandCoins, Info } from 'lucide-react'

type Row = {
  seller_id: string
  seller_name: string
  revenue: number        // customers paid the seller
  their_profit: number   // seller keeps (40%)
  my_profit: number      // owner keeps (60%)
  cost: number           // owner's wholesale cost coming back
  owed: number           // must hand over = cost + my_profit
  received: number       // handed over so far
  balance: number        // still owed (can be negative = overpaid)
}
type Payment = { id: string; seller_id: string; amount: number; note: string | null; paid_at: string }

export default function Payments({ rows: initialRows, payments: initialPayments }: { rows: Row[]; payments: Payment[] }) {
  const [rows, setRows] = useState<Row[]>(initialRows)
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [sellerId, setSellerId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const nameOf = (id: string) => rows.find(b => b.seller_id === id)?.seller_name ?? '—'

  // Totals across all sellers (the owner's big picture)
  const totalMyProfit  = rows.reduce((s, r) => s + r.my_profit, 0)
  const totalToCollect  = rows.reduce((s, r) => s + Math.max(0, r.balance), 0)
  const totalCollected = rows.reduce((s, r) => s + r.received, 0)

  async function refresh(supabase: ReturnType<typeof createBrowser>) {
    // Re-pull balances + payments after a change. Profit columns (revenue/their/my profit)
    // don't change when you record a payment — only received/balance do — so we update those
    // in place and keep the profit split from the initial server render.
    const [balB, payB] = await Promise.all([
      supabase.from('v_seller_balances').select('seller_id, received, balance, total_owed'),
      supabase.from('payments').select('id, seller_id, amount, note, paid_at').order('paid_at', { ascending: false }),
    ])
    if (balB.data) {
      setRows(prev => prev.map(r => {
        const b = balB.data!.find(x => x.seller_id === r.seller_id)
        return b ? { ...r, received: b.received, balance: b.balance, owed: b.total_owed } : r
      }))
    }
    if (payB.data) setPayments(payB.data)
  }

  async function record(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createBrowser()
    const { error: err } = await supabase.from('payments').insert({ seller_id: sellerId, amount: Number(amount), note: note || null })
    if (err) { setError(err.message); setLoading(false); return }
    await refresh(supabase)
    setLoading(false); setSuccess(true); setAmount(''); setNote(''); setSellerId('')
    setTimeout(() => setSuccess(false), 1500)
  }

  async function settleFull(r: Row) {
    if (r.balance <= 0) return
    if (!confirm(`${r.seller_name} uchun ${formatUZS(r.balance)} to'liq to'lov qilinsinmi?`)) return
    const supabase = createBrowser()
    const { error: err } = await supabase.from('payments').insert({ seller_id: r.seller_id, amount: r.balance, note: "To'liq hisob-kitob" })
    if (err) { setError(err.message); return }
    await refresh(supabase)
  }

  async function deletePayment(id: string) {
    if (!confirm("Bu to'lovni o'chirasizmi?")) return
    const supabase = createBrowser()
    const { error: err } = await supabase.from('payments').delete().eq('id', id)
    if (err) { setError(err.message); return }
    await refresh(supabase)
  }

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <h2 className="font-display font-bold text-ink text-2xl">To'lovlar va foyda</h2>

        {/* How it works — plain explainer */}
        <div className="bg-gradient-to-br from-sky/10 to-lavender/10 border border-lavender/30 rounded-2xl p-5 flex gap-3">
          <Info className="w-5 h-5 text-lavender flex-shrink-0 mt-0.5" />
          <div className="text-sm text-ink leading-relaxed">
            <b>Qanday ishlaydi:</b> Sotuvchi mijozdan <b>to'liq pul</b> oladi. O'z foydasini
            (<b>foydaning 40%</b>) o'zida qoldiradi. Qolganini — ya'ni <b>tovar puli + sizning 60% foydangiz</b> —
            sizga topshiradi. Demak "Topshirish kerak" summasi hammasi foyda emas: ko'p qismi
            tovaringiz puli qaytib kelmoqda.
          </div>
        </div>

        {/* Owner KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-mint to-success text-white rounded-2xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-2"><p className="text-sm font-medium opacity-80">Mening jami foydam</p><TrendingUp className="w-5 h-5 opacity-70" /></div>
            <p className="font-display text-2xl font-bold">{formatUZS(totalMyProfit)}</p>
          </div>
          <div className="bg-gradient-to-br from-peach to-warning text-white rounded-2xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-2"><p className="text-sm font-medium opacity-80">Yig'ilishi kerak</p><HandCoins className="w-5 h-5 opacity-70" /></div>
            <p className="font-display text-2xl font-bold">{formatUZS(totalToCollect)}</p>
          </div>
          <div className="bg-gradient-to-br from-sky to-lavender text-white rounded-2xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-2"><p className="text-sm font-medium opacity-80">Yig'ilgan</p><Wallet className="w-5 h-5 opacity-70" /></div>
            <p className="font-display text-2xl font-bold">{formatUZS(totalCollected)}</p>
          </div>
        </div>

        {/* Per-seller breakdown */}
        <div className="bg-surface rounded-2xl shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-4 font-semibold text-muted">Sotuvchi</th>
                <th className="text-right px-3 py-4 font-semibold text-muted">Sotgan</th>
                <th className="text-right px-3 py-4 font-semibold text-muted">Ularning foydasi<br /><span className="font-normal text-[11px]">(40%, o'zida)</span></th>
                <th className="text-right px-3 py-4 font-semibold text-success">Mening foydam<br /><span className="font-normal text-[11px]">(60%)</span></th>
                <th className="text-right px-3 py-4 font-semibold text-muted">Topshirish kerak<br /><span className="font-normal text-[11px]">(tovar+foydam)</span></th>
                <th className="text-right px-3 py-4 font-semibold text-muted">Topshirilgan</th>
                <th className="text-right px-3 py-4 font-semibold text-muted">Qolgan</th>
                <th className="px-3 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.seller_id} className={i % 2 === 1 ? 'bg-cream/50' : ''}>
                  <td className="px-5 py-4 font-semibold text-ink">{r.seller_name}</td>
                  <td className="px-3 py-4 text-right text-ink">{formatUZS(r.revenue)}</td>
                  <td className="px-3 py-4 text-right text-muted">{formatUZS(r.their_profit)}</td>
                  <td className="px-3 py-4 text-right font-display font-bold text-success">{formatUZS(r.my_profit)}</td>
                  <td className="px-3 py-4 text-right text-warning font-medium">{formatUZS(r.owed)}</td>
                  <td className="px-3 py-4 text-right text-success">{formatUZS(r.received)}</td>
                  <td className={`px-3 py-4 text-right font-display font-bold ${r.balance > 0 ? 'text-danger' : 'text-success'}`}>
                    {r.balance < 0 ? `+${formatUZS(-r.balance)}` : formatUZS(r.balance)}
                  </td>
                  <td className="px-3 py-4 text-right">
                    {r.balance > 0 && (
                      <button onClick={() => settleFull(r)} title="To'liq to'lov"
                        className="text-xs text-rose hover:text-roseDark font-medium whitespace-nowrap">To'liq ✓</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted -mt-3">
          "Qolgan" ustunidagi <span className="text-success font-semibold">+summa</span> — siz sotuvchiga ortiqcha qaytarishingiz kerakligini bildiradi.
        </p>

        {/* Record payment */}
        <div className="bg-surface rounded-2xl shadow-card p-6">
          <h3 className="font-display font-bold text-ink text-lg mb-5 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-rose" /> To'lov qabul qilish
          </h3>
          <form onSubmit={record} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-muted mb-1">Sotuvchi</label>
              <select value={sellerId} onChange={e => setSellerId(e.target.value)} required
                className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition">
                <option value="">Tanlang…</option>
                {rows.map(r => <option key={r.seller_id} value={r.seller_id}>{r.seller_name} — qoldi: {formatUZS(Math.max(0, r.balance))}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-muted mb-1">Miqdor (so'm)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required min={1}
                placeholder="Masalan: 500000"
                className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-muted mb-1">Izoh (ixtiyoriy)</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Masalan: naqd pul"
                className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            {success && <div className="flex items-center gap-2 text-success text-sm font-semibold"><CheckCircle className="w-4 h-4" /> Saqlandi!</div>}
            <button type="submit" disabled={loading}
              className="bg-gradient-to-br from-rose to-peach text-white font-display font-bold px-8 py-3 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50">
              {loading ? 'Saqlanmoqda…' : "To'lovni saqlash"}
            </button>
          </form>
        </div>

        {/* Payment history */}
        <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <History className="w-4 h-4 text-rose" />
            <h3 className="font-display font-bold text-ink text-lg">To'lov tarixi</h3>
          </div>
          {payments.length === 0 ? (
            <p className="text-muted text-sm px-6 py-8 text-center">Hali to'lov yo'q</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 font-semibold text-muted">Sana</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted">Sotuvchi</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted">Izoh</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted">Miqdor</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 1 ? 'bg-cream/50' : ''}>
                    <td className="px-6 py-3 text-muted">{formatDate(p.paid_at)}</td>
                    <td className="px-4 py-3 font-medium text-ink">{nameOf(p.seller_id)}</td>
                    <td className="px-4 py-3 text-muted">{p.note ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-display font-bold text-success">{formatUZS(p.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => deletePayment(p.id)} title="O'chirish" className="text-danger/50 hover:text-danger transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

  const [salesRes, balRes, paymentsRes] = await Promise.all([
    supabase.from('v_sales_enriched').select('seller_id, revenue, cost_total, seller_profit, my_profit, owed_to_me'),
    supabase.from('v_seller_balances').select('seller_id, seller_name, total_owed, received, balance').order('seller_name'),
    supabase.from('payments').select('id, seller_id, amount, note, paid_at').order('paid_at', { ascending: false }),
  ])

  // Aggregate the profit split per seller from individual sales
  const agg: Record<string, { revenue: number; cost: number; their_profit: number; my_profit: number; owed: number }> = {}
  for (const r of salesRes.data ?? []) {
    const a = agg[r.seller_id] ??= { revenue: 0, cost: 0, their_profit: 0, my_profit: 0, owed: 0 }
    a.revenue += r.revenue; a.cost += r.cost_total; a.their_profit += r.seller_profit; a.my_profit += r.my_profit; a.owed += r.owed_to_me
  }

  const rows: Row[] = (balRes.data ?? []).map(b => {
    const a = agg[b.seller_id] ?? { revenue: 0, cost: 0, their_profit: 0, my_profit: 0, owed: 0 }
    return {
      seller_id: b.seller_id,
      seller_name: b.seller_name,
      revenue: a.revenue,
      their_profit: a.their_profit,
      my_profit: a.my_profit,
      cost: a.cost,
      owed: b.total_owed,       // includes any opening_balance
      received: b.received,
      balance: b.balance,
    }
  })

  return { props: { rows, payments: paymentsRes.data ?? [] } }
}
