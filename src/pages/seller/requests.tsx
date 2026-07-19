import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatDate, formatUZS } from '@/lib/format'
import SellerNav from '@/components/SellerNav'
import { ClipboardList } from 'lucide-react'

type MyRequest = {
  id: string; product_id: string; product_name: string; type: 'correction' | 'new_product'
  current_qty: number; requested_qty: number; reason: string | null
  status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string
}
type MyPriceRequest = {
  id: string; product_name: string; qty: number
  current_price: number; requested_price: number; reason: string | null
  status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string
}
type MyTransfer = {
  id: string; product_name: string; qty: number; from_name: string; to_name: string
  is_outgoing: boolean; status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string
}
type Props = { requests: MyRequest[]; priceRequests: MyPriceRequest[]; transfers: MyTransfer[] }

const REQ_BADGE: Record<MyRequest['status'], { label: string; cls: string }> = {
  pending:  { label: 'Kutilmoqda', cls: 'bg-orange-100 text-warning' },
  approved: { label: 'Tasdiqlandi', cls: 'bg-green-100 text-success' },
  rejected: { label: 'Rad etildi',  cls: 'bg-red-100 text-danger' },
}

export default function SellerRequests({ requests, priceRequests, transfers }: Props) {
  const nothing = requests.length === 0 && priceRequests.length === 0 && transfers.length === 0
  return (
    <div className="min-h-screen bg-cream pb-28">
      <header className="bg-gradient-to-br from-rose to-peach text-white px-5 pt-10 pb-8">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          <h1 className="font-display text-xl font-bold">So'rovlarim</h1>
        </div>
        <p className="text-white/80 text-sm mt-1">Tuzatish, yangi mahsulot va narx so'rovlaringiz holati</p>
      </header>

      <main className="px-4 -mt-4 relative z-10 space-y-2">
        {nothing && (
          <div className="bg-surface rounded-2xl shadow-card p-10 text-center text-muted">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Hozircha so'rov yo'q</p>
            <p className="text-xs mt-1">Mahsulot yoki sotuv sahifasida tuzatish so'rovini yuboring.</p>
          </div>
        )}

        {requests.map(r => (
          <div key={r.id} className="bg-surface rounded-2xl shadow-card px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{r.product_name}</p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${r.type === 'new_product' ? 'bg-sky/15 text-sky' : 'bg-lavender/20 text-ink'}`}>
                  {r.type === 'new_product' ? 'Yangi' : 'Tuzatish'}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${REQ_BADGE[r.status].cls}`}>
                {REQ_BADGE[r.status].label}
              </span>
            </div>
            <p className="text-xs text-muted">
              {r.type === 'new_product' ? `${r.requested_qty} ta so'raldi` : `${r.current_qty} → ${r.requested_qty} ta`}
              {r.reason ? ` · "${r.reason}"` : ''} · {formatDate(r.created_at)}
            </p>
            {r.admin_note && <p className="text-xs text-muted mt-0.5">Admin: {r.admin_note}</p>}
          </div>
        ))}

        {priceRequests.map(r => (
          <div key={r.id} className="bg-surface rounded-2xl shadow-card px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{r.product_name}</p>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 bg-peach/25 text-ink">Narx</span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${REQ_BADGE[r.status].cls}`}>
                {REQ_BADGE[r.status].label}
              </span>
            </div>
            <p className="text-xs text-muted">
              {formatUZS(r.current_price)} → {formatUZS(r.requested_price)}
              {r.reason ? ` · "${r.reason}"` : ''} · {formatDate(r.created_at)}
            </p>
            {r.admin_note && <p className="text-xs text-muted mt-0.5">Admin: {r.admin_note}</p>}
          </div>
        ))}

        {transfers.map(r => (
          <div key={r.id} className="bg-surface rounded-2xl shadow-card px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{r.product_name}</p>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 bg-mint/25 text-ink">
                  {r.is_outgoing ? 'Qaytarildi' : 'Qabul'}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${REQ_BADGE[r.status].cls}`}>
                {REQ_BADGE[r.status].label}
              </span>
            </div>
            <p className="text-xs text-muted">
              {r.from_name} → {r.to_name} · {r.qty} ta · {formatDate(r.created_at)}
            </p>
            {r.admin_note && <p className="text-xs text-muted mt-0.5">Admin: {r.admin_note}</p>}
          </div>
        ))}
      </main>

      <SellerNav />
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'seller')
  if (guard) return guard
  const supabase = createClient(ctx)
  const [{ data }, { data: priceData }, { data: transferData }] = await Promise.all([
    supabase.from('v_my_requests').select('*'),
    supabase.from('v_my_price_requests').select('*'),
    supabase.from('v_my_transfers').select('*'),
  ])
  return { props: { requests: data ?? [], priceRequests: priceData ?? [], transfers: transferData ?? [] } }
}
