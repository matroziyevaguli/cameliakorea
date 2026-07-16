import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS, formatDate } from '@/lib/format'
import Link from 'next/link'
import { ShoppingBag, History, Wallet, Sparkles, CircleDollarSign, CheckCircle2 } from 'lucide-react'
import { S } from '@/consts/strings'

// From v_my_summary (a definer view — correct for sellers, unlike v_seller_balances
// which returns 0 because of the products-RLS cascade).
type Summary = {
  your_total_profit: number   // her 40% — hers to keep
  total_owed: number          // total she must hand over
  submitted: number           // already handed over
  not_submitted: number       // still owed
}
type Payment = { id: string; amount: number; note: string | null; paid_at: string }

type Props = { summary: Summary | null; payments: Payment[] }

export default function MyBalance({ summary, payments }: Props) {
  if (!summary) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <p className="text-muted">{S.noData}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-gradient-to-br from-rose to-peach text-white px-5 pt-8 pb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <h1 className="font-display text-2xl font-bold relative">{S.myBalance}</h1>
      </header>

      <main className="px-4 -mt-6 pb-28 relative z-10 space-y-3">

        {/* Your earnings — the friendly, positive number (her 40%) */}
        <div className="rounded-2xl p-6 shadow-rose text-white bg-gradient-to-br from-success to-mint">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-6 h-6 opacity-90" />
            <p className="font-medium opacity-90">{S.myEarnings}</p>
          </div>
          <p className="font-display text-4xl font-bold">{formatUZS(summary.your_total_profit)}</p>
          <p className="text-white/80 text-xs mt-2">{S.earningsHint}</p>
        </div>

        {/* Hand-over block */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface rounded-2xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <p className="text-xs font-medium text-muted">{S.handedOver}</p>
            </div>
            <p className="font-display text-xl font-bold text-success">{formatUZS(summary.submitted)}</p>
          </div>
          <div className="bg-surface rounded-2xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-2">
              <CircleDollarSign className="w-4 h-4 text-muted" />
              <p className="text-xs font-medium text-muted">{S.toHandOver}</p>
            </div>
            <p className="font-display text-xl font-bold text-ink">{formatUZS(summary.total_owed)}</p>
          </div>
        </div>

        {/* Still owed — the big number that matters */}
        <div className={`rounded-2xl p-6 shadow-card ${summary.not_submitted > 0 ? 'bg-gradient-to-br from-rose to-peach text-white' : 'bg-gradient-to-br from-success to-mint text-white'}`}>
          <p className="font-medium opacity-90 mb-1">{S.stillOwed}</p>
          <p className="font-display text-4xl font-bold">{formatUZS(Math.max(0, summary.not_submitted))}</p>
          {summary.not_submitted <= 0 && <p className="text-white/80 text-sm mt-2">{S.settled}</p>}
        </div>

        {/* Payment history */}
        <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <History className="w-4 h-4 text-rose" />
            <h3 className="font-display font-bold text-ink text-base">{S.paymentHistory}</h3>
          </div>
          {payments.length === 0 ? (
            <p className="text-muted text-sm px-5 py-6 text-center">{S.noPayments}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {payments.map(p => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-display font-bold text-success">{formatUZS(p.amount)}</p>
                    {p.note && <p className="text-xs text-muted mt-0.5">{p.note}</p>}
                  </div>
                  <p className="text-xs text-muted">{formatDate(p.paid_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-100 flex z-20 shadow-card">
        <Link href="/seller" className="flex-1 flex flex-col items-center gap-1 py-3 text-muted hover:text-rose transition">
          <ShoppingBag className="w-5 h-5" />
          <span className="text-xs font-medium">Mahsulotlar</span>
        </Link>
        <Link href="/seller/sales" className="flex-1 flex flex-col items-center gap-1 py-3 text-muted hover:text-rose transition">
          <History className="w-5 h-5" />
          <span className="text-xs font-medium">Tarix</span>
        </Link>
        <Link href="/seller/balance" className="flex-1 flex flex-col items-center gap-1 py-3 text-rose">
          <Wallet className="w-5 h-5" />
          <span className="text-xs font-medium">Hisobim</span>
        </Link>
      </nav>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'seller')
  if (guard) return guard

  const supabase = createClient(ctx)
  const { data: { session } } = await supabase.auth.getSession()

  const { data: profile } = await supabase
    .from('profiles').select('id').eq('user_id', session!.user.id).single()

  // v_my_summary is a definer view → correct numbers even with the products-RLS cascade.
  // (v_seller_balances returns balance=0 for sellers — do NOT use it here.)
  const [summaryRes, paymentsRes] = await Promise.all([
    supabase.from('v_my_summary').select('your_total_profit, total_owed, submitted, not_submitted').maybeSingle(),
    supabase.from('payments').select('id, amount, note, paid_at').eq('seller_id', profile!.id).order('paid_at', { ascending: false }),
  ])

  return { props: { summary: summaryRes.data ?? null, payments: paymentsRes.data ?? [] } }
}
