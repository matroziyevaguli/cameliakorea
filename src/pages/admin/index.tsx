import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS } from '@/lib/format'
import { S } from '@/consts/strings'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatDate } from '@/lib/format'
import AdminNav from '@/components/AdminNav'
import { TrendingUp, DollarSign, AlertCircle, ShoppingCart, Wallet, Package, Sparkles, Gift } from 'lucide-react'

type ProductStat = { name: string; units_sold: number; revenue: number }
type RecentSale = { seller_name: string; product_name: string; qty: number; revenue: number; sold_at: string }
type KPIs = { totalRevenue: number; myProfit: number; totalOutstanding: number; unitsSold: number }
// Business progress (discounts applied to worth/expected)
type Biz = {
  invested: number        // Σ cost × total_qty
  worth: number           // Σ (discount ?? retail) × total_qty
  expectedProfit: number  // worth − invested (gross, if all sells)
  soldRevenue: number     // Σ sales revenue so far
  giveawayUnits: number
  giveawayValue: number   // at cost
}
type Props = { kpis: KPIs; biz: Biz; productStats: ProductStat[]; recentSales: RecentSale[] }

const CHART_COLORS = ['#F4628E','#B9A7F0','#6FD8C0','#7CC4F2','#FFB088','#F4628E','#B9A7F0','#6FD8C0']

const kpiCards = (k: KPIs) => [
  { label: 'Umumiy savdo',     value: formatUZS(k.totalRevenue),    icon: DollarSign,  bg: 'bg-gradient-to-br from-rose to-roseDark',     text: 'text-white' },
  { label: S.earningsAdmin,    value: formatUZS(k.myProfit),        icon: TrendingUp,  bg: 'bg-gradient-to-br from-mint to-success',      text: 'text-white' },
  { label: S.moneyCollect,     value: formatUZS(k.totalOutstanding),icon: AlertCircle, bg: 'bg-gradient-to-br from-peach to-warning',     text: 'text-white' },
  { label: 'Sotilgan (dona)',  value: String(k.unitsSold),          icon: ShoppingCart,bg: 'bg-gradient-to-br from-lavender to-sky',      text: 'text-white' },
]

function Metric({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-surface rounded-2xl p-5 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-muted">{label}</p>
        <Icon className="w-5 h-5 text-muted" />
      </div>
      <p className={`font-display text-xl font-bold ${accent ? 'text-success' : 'text-ink'}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AdminDashboard({ kpis, biz, productStats, recentSales }: Props) {
  const pct = biz.worth > 0 ? (biz.soldRevenue / biz.worth) * 100 : 0
  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Business progress */}
        <div className="space-y-4">
          <h2 className="font-display font-bold text-ink text-lg">Biznes holati</h2>

          {/* Progress hero — sold vs total worth */}
          <div className="bg-gradient-to-br from-rose to-roseDark text-white rounded-2xl p-6 shadow-card">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div>
                <p className="text-sm opacity-80">Sotildi</p>
                <p className="font-display text-3xl font-bold">{formatUZS(biz.soldRevenue)}</p>
              </div>
              <p className="text-sm opacity-80 mb-1">/ {formatUZS(biz.worth)}</p>
            </div>
            <div className="h-3 bg-white/25 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <p className="text-xs opacity-90 mt-2">{pct.toFixed(1)}% — umumiy mahsulot qiymatidan sotilgan</p>
          </div>

          {/* Metric grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Metric icon={Wallet}   label="Qo'yilgan pul"       value={formatUZS(biz.invested)}       sub="tovarga sarflangan" />
            <Metric icon={Package}  label="Umumiy qiymati"      value={formatUZS(biz.worth)}          sub="hammasining narxi" />
            <Metric icon={Sparkles} label="Kutilayotgan foyda"  value={formatUZS(biz.expectedProfit)} sub="agar hammasi sotilsa" accent />
            <Metric icon={Gift}     label="Sovg'alar"           value={`${biz.giveawayUnits} dona`}   sub={`${formatUZS(biz.giveawayValue)} xarajat`} />
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards(kpis).map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} className={`${card.bg} ${card.text} rounded-2xl p-5 shadow-card`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium opacity-80">{card.label}</p>
                  <Icon className="w-5 h-5 opacity-70" />
                </div>
                <p className="font-display text-2xl font-bold">{card.value}</p>
              </div>
            )
          })}
        </div>

        {/* Bar chart */}
        <div className="bg-surface rounded-2xl shadow-card p-6">
          <h2 className="font-display font-bold text-ink text-lg mb-5">Ko'p sotilgan mahsulotlar</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={productStats} margin={{ left: 0, right: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#8A7F8C', fontSize: 11, fontFamily: 'var(--font-inter)' }} />
              <YAxis tick={{ fill: '#8A7F8C', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 8px 30px rgba(244,98,142,0.12)', fontFamily: 'var(--font-inter)' }}
                formatter={(v: number) => [v, 'Sotildi']}
              />
              <Bar dataKey="units_sold" radius={[8, 8, 0, 0]}>
                {productStats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent sales */}
        <div className="bg-surface rounded-2xl shadow-card p-6">
          <h2 className="font-display font-bold text-ink text-lg mb-4">So'nggi sotuvlar</h2>
          <div className="space-y-1">
            {recentSales.map((s, i) => (
              <div key={i} className={`flex justify-between items-center py-3 px-3 rounded-xl ${i % 2 === 0 ? 'bg-cream' : ''}`}>
                <div>
                  <span className="font-semibold text-rose">{s.seller_name}</span>
                  <span className="text-muted mx-2">·</span>
                  <span className="text-ink">{s.product_name}</span>
                  <span className="text-muted text-sm ml-2">×{s.qty}</span>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold text-success">{formatUZS(s.revenue)}</p>
                  <p className="text-xs text-muted">{formatDate(s.sold_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'admin')
  if (guard) return guard

  const supabase = createClient(ctx)
  const [{ data: recent }, { data: productStats }, { data: balances }, { data: allSales }, { data: products }, { data: adjustments }] = await Promise.all([
    // Recent feed (15 newest) — display only
    supabase.from('v_sales_enriched').select('revenue, sold_at, seller_name, product_name, qty').order('sold_at', { ascending: false }).limit(15),
    // Chart: top 8 products
    supabase.from('v_product_stats').select('name, units_sold, revenue').order('units_sold', { ascending: false }).limit(8),
    supabase.from('v_seller_balances').select('balance'),
    // ALL sales — for the TRUE totals (not just the last 20)
    supabase.from('v_sales_enriched').select('revenue, my_profit, qty'),
    // Inventory value + capital
    supabase.from('products').select('id, cost, total_qty, retail_price, discount_price'),
    // Giveaways (+ damaged/lost) for the "Sovg'a" metric
    supabase.from('stock_adjustments').select('reason, qty, product_id'),
  ])

  const kpis: KPIs = {
    totalRevenue:    (allSales ?? []).reduce((s, r) => s + r.revenue, 0),
    myProfit:        (allSales ?? []).reduce((s, r) => s + r.my_profit, 0),
    totalOutstanding:(balances ?? []).reduce((s, r) => s + Math.max(0, r.balance), 0),
    unitsSold:       (allSales ?? []).reduce((s, r) => s + r.qty, 0),
  }

  const prods = products ?? []
  const costById: Record<string, number> = {}
  for (const p of prods) costById[p.id] = p.cost ?? 0
  const invested = prods.reduce((s, p) => s + (p.cost ?? 0) * (p.total_qty ?? 0), 0)
  const worth    = prods.reduce((s, p) => s + ((p.discount_price ?? p.retail_price) ?? 0) * (p.total_qty ?? 0), 0)
  const giveaways = (adjustments ?? []).filter(a => a.reason === 'giveaway' || a.reason === 'gift')
  const biz: Biz = {
    invested,
    worth,
    expectedProfit: worth - invested,
    soldRevenue:    kpis.totalRevenue,
    giveawayUnits:  giveaways.reduce((s, a) => s + (a.qty ?? 0), 0),
    giveawayValue:  giveaways.reduce((s, a) => s + (costById[a.product_id] ?? 0) * (a.qty ?? 0), 0),
  }

  return { props: { kpis, biz, productStats: productStats ?? [], recentSales: recent ?? [] } }
}
