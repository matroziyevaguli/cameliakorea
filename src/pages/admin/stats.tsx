import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS } from '@/lib/format'
import AdminNav from '@/components/AdminNav'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'

type ProductStat = { product_id: string; name: string; total_qty: number; units_sold: number; units_remaining: number; revenue: number }
type SellerStat  = { seller_id: string; seller_name: string; owed_from_sales: number; received: number; balance: number }

const COLORS = ['#F4628E','#B9A7F0','#6FD8C0','#7CC4F2','#FFB088','#E14B79','#8fb0f0','#a0d8c4']

export default function Stats({ productStats, sellerStats }: { productStats: ProductStat[]; sellerStats: SellerStat[] }) {
  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <h2 className="font-display font-bold text-ink text-2xl">Statistika</h2>

        {/* Product chart */}
        <div className="bg-surface rounded-2xl shadow-card p-6">
          <h3 className="font-display font-bold text-ink text-lg mb-5">Mahsulot hisoboti</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={productStats} margin={{ left: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#8A7F8C', fontSize: 10, fontFamily: 'var(--font-inter)' }} />
              <YAxis tick={{ fill: '#8A7F8C', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 8px 30px rgba(244,98,142,0.12)' }}
                formatter={(v: number, n: string) => [v, n === 'units_sold' ? 'Sotildi' : 'Qoldi']} />
              <Legend formatter={v => v === 'units_sold' ? 'Sotildi' : 'Qoldi'} />
              <Bar dataKey="units_sold" fill="#F4628E" radius={[6, 6, 0, 0]} name="units_sold" />
              <Bar dataKey="units_remaining" fill="#B9A7F0" radius={[6, 6, 0, 0]} name="units_remaining" />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-3 font-semibold text-muted">Mahsulot</th>
                  <th className="text-right py-3 px-3 font-semibold text-muted">Jami</th>
                  <th className="text-right py-3 px-3 font-semibold text-muted">Sotildi</th>
                  <th className="text-right py-3 px-3 font-semibold text-muted">Qoldi</th>
                  <th className="text-right py-3 px-3 font-semibold text-muted">Tushum</th>
                </tr>
              </thead>
              <tbody>
                {productStats.map((p, i) => (
                  <tr key={p.product_id} className={i % 2 === 1 ? 'bg-cream/50' : ''}>
                    <td className="py-3 px-3 font-medium text-ink">{p.name}</td>
                    <td className="py-3 px-3 text-right text-muted">{p.total_qty}</td>
                    <td className="py-3 px-3 text-right text-rose font-semibold">{p.units_sold}</td>
                    <td className="py-3 px-3 text-right text-ink">{p.units_remaining}</td>
                    <td className="py-3 px-3 text-right font-display font-bold text-success">{formatUZS(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Seller stats */}
        <div className="bg-surface rounded-2xl shadow-card p-6">
          <h3 className="font-display font-bold text-ink text-lg mb-5">Sotuvchi natijalari</h3>
          <div className="grid grid-cols-3 gap-4 mb-5">
            {sellerStats.map((s, i) => (
              <div key={s.seller_id} className="rounded-xl p-4" style={{ backgroundColor: `${COLORS[i % COLORS.length]}20` }}>
                <p className="font-display font-bold text-ink text-base">{s.seller_name}</p>
                <p className="text-xs text-muted mt-2">Sotuvdan qarz</p>
                <p className="font-semibold text-warning text-sm">{formatUZS(s.owed_from_sales)}</p>
                <p className="text-xs text-muted mt-1">To'lagan</p>
                <p className="font-semibold text-success text-sm">{formatUZS(s.received)}</p>
                <p className="text-xs text-muted mt-1">Qoldi</p>
                <p className={`font-display font-bold ${s.balance > 0 ? 'text-danger' : 'text-success'}`}>{formatUZS(s.balance)}</p>
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
  const [{ data: productStats }, { data: sellerStats }] = await Promise.all([
    supabase.from('v_product_stats').select('*').order('units_sold', { ascending: false }),
    supabase.from('v_seller_balances').select('*').order('seller_name'),
  ])
  return { props: { productStats: productStats ?? [], sellerStats: sellerStats ?? [] } }
}
