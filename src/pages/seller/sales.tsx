import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS } from '@/lib/format'
import { useState } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import { useRouter } from 'next/router'
import { ShoppingBag, History, Wallet, Trash2, Package } from 'lucide-react'
import { formatDate } from '@/lib/format'
import Link from 'next/link'
import { S } from '@/consts/strings'

type Sale = {
  id: string
  product_name: string
  qty: number
  unit_price: number
  revenue: number
  your_profit: number
  sold_at: string
  note: string | null
}

export default function MySales({ sales }: { sales: Sale[] }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)

  async function deleteSale(id: string) {
    if (!confirm(S.deleteConfirm)) return
    setDeleting(id)
    const supabase = createBrowser()
    await supabase.from('sales').delete().eq('id', id)
    router.replace(router.asPath)
    setDeleting(null)
  }

  return (
    <div className="min-h-screen bg-cream pb-28">
      <header className="bg-gradient-to-br from-rose to-peach text-white px-5 pt-10 pb-14 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/4" />
        <h1 className="font-display text-2xl font-bold relative">{S.mySales}</h1>
      </header>

      <main className="px-4 -mt-6 relative z-10">
        {sales.length === 0 ? (
          <div className="bg-surface rounded-2xl shadow-card p-10 text-center text-muted">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{S.noSales}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sales.map(sale => (
              <div key={sale.id} className="bg-surface rounded-2xl shadow-card p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-ink truncate">{sale.product_name}</p>
                    <p className="text-sm text-muted mt-1">
                      {sale.qty} × {formatUZS(sale.unit_price)}
                    </p>
                    {/* Profit — visible to seller, never shows cost */}
                    <p className="text-xs font-semibold text-rose mt-1">
                      Foyda: {formatUZS(sale.your_profit)}
                    </p>
                    {sale.note && <p className="text-xs text-muted mt-0.5 italic">{sale.note}</p>}
                    <p className="text-xs text-muted/60 mt-1">
                      {formatDate(sale.sold_at, true)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-display font-bold text-success text-lg">{formatUZS(sale.revenue)}</p>
                    <button onClick={() => deleteSale(sale.id)} disabled={deleting === sale.id}
                      className="mt-2 text-danger/40 hover:text-danger transition disabled:opacity-30">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-100 flex z-20 shadow-card">
        <Link href="/seller" className="flex-1 flex flex-col items-center gap-1 py-3 text-muted hover:text-rose transition">
          <ShoppingBag className="w-5 h-5" /><span className="text-xs font-medium">Mahsulotlar</span>
        </Link>
        <Link href="/seller/sales" className="flex-1 flex flex-col items-center gap-1 py-3 text-rose">
          <History className="w-5 h-5" /><span className="text-xs font-medium">Tarix</span>
        </Link>
        <Link href="/seller/balance" className="flex-1 flex flex-col items-center gap-1 py-3 text-muted hover:text-rose transition">
          <Wallet className="w-5 h-5" /><span className="text-xs font-medium">Hisobim</span>
        </Link>
      </nav>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'seller')
  if (guard) return guard

  const supabase = createClient(ctx)
  const { data: sales } = await supabase
    .from('v_my_sales')
    .select('id, product_name, qty, unit_price, revenue, your_profit, sold_at, note')
    .order('sold_at', { ascending: false })
    .limit(100)

  return { props: { sales: sales ?? [] } }
}
