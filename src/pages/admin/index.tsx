import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS } from '@/lib/format'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatDate } from '@/lib/format'
import AdminNav from '@/components/AdminNav'
import { TrendingUp, DollarSign, AlertCircle, ShoppingCart } from 'lucide-react'

type ProductStat = { name: string; units_sold: number; revenue: number }
type RecentSale = { seller_name: string; product_name: string; qty: number; revenue: number; sold_at: string }
type KPIs = { totalRevenue: number; myProfit: number; totalOutstanding: number; unitsSold: number }
type Props = { kpis: KPIs; productStats: ProductStat[]; recentSales: RecentSale[] }

const CHART_COLORS = ['#F4628E','#B9A7F0','#6FD8C0','#7CC4F2','#FFB088','#F4628E','#B9A7F0','#6FD8C0']

const kpiCards = (k: KPIs) => [
  { label: 'Total Revenue',      value: formatUZS(k.totalRevenue),    icon: DollarSign,  bg: 'bg-gradient-to-br from-rose to-roseDark',     text: 'text-white' },
  { label: 'My Profit',          value: formatUZS(k.myProfit),        icon: TrendingUp,  bg: 'bg-gradient-to-br from-mint to-success',      text: 'text-white' },
  { label: 'Total Outstanding',  value: formatUZS(k.totalOutstanding),icon: AlertCircle, bg: 'bg-gradient-to-br from-peach to-warning',     text: 'text-white' },
  { label: 'Units Sold',         value: String(k.unitsSold),          icon: ShoppingCart,bg: 'bg-gradient-to-br from-lavender to-sky',      text: 'text-white' },
]

export default function AdminDashboard({ kpis, productStats, recentSales }: Props) {
  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-6 max-w-6xl mx-auto space-y-6">

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
          <h2 className="font-display font-bold text-ink text-lg mb-5">Best-selling products</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={productStats} margin={{ left: 0, right: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#8A7F8C', fontSize: 11, fontFamily: 'var(--font-inter)' }} />
              <YAxis tick={{ fill: '#8A7F8C', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 8px 30px rgba(244,98,142,0.12)', fontFamily: 'var(--font-inter)' }}
                formatter={(v: number) => [v, 'Units sold']}
              />
              <Bar dataKey="units_sold" radius={[8, 8, 0, 0]}>
                {productStats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent sales */}
        <div className="bg-surface rounded-2xl shadow-card p-6">
          <h2 className="font-display font-bold text-ink text-lg mb-4">Recent sales</h2>
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
  const [{ data: salesData }, { data: productStats }, { data: balances }] = await Promise.all([
    supabase.from('v_sales_enriched').select('revenue, my_profit, owed_to_me, sold_at, seller_name, product_name, qty').order('sold_at', { ascending: false }).limit(20),
    supabase.from('v_product_stats').select('name, units_sold, revenue').order('units_sold', { ascending: false }).limit(8),
    supabase.from('v_seller_balances').select('balance'),
  ])

  const kpis: KPIs = {
    totalRevenue:    (salesData ?? []).reduce((s, r) => s + r.revenue, 0),
    myProfit:        (salesData ?? []).reduce((s, r) => s + r.my_profit, 0),
    totalOutstanding:(balances ?? []).reduce((s, r) => s + Math.max(0, r.balance), 0),
    unitsSold:       (salesData ?? []).reduce((s, r) => s + r.qty, 0),
  }

  return { props: { kpis, productStats: productStats ?? [], recentSales: (salesData ?? []).slice(0, 15) } }
}
