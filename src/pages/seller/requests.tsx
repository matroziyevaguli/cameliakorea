import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatDate } from '@/lib/format'
import SellerNav from '@/components/SellerNav'
import { ClipboardList } from 'lucide-react'

type MyRequest = {
  id: string; product_id: string; product_name: string; type: 'correction' | 'new_product'
  current_qty: number; requested_qty: number; reason: string | null
  status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string
}
type Props = { requests: MyRequest[] }

const REQ_BADGE: Record<MyRequest['status'], { label: string; cls: string }> = {
  pending:  { label: 'Kutilmoqda', cls: 'bg-orange-100 text-warning' },
  approved: { label: 'Tasdiqlandi', cls: 'bg-green-100 text-success' },
  rejected: { label: 'Rad etildi',  cls: 'bg-red-100 text-danger' },
}

export default function SellerRequests({ requests }: Props) {
  return (
    <div className="min-h-screen bg-cream pb-28">
      <header className="bg-gradient-to-br from-rose to-peach text-white px-5 pt-10 pb-8">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5" />
          <h1 className="font-display text-xl font-bold">So'rovlarim</h1>
        </div>
        <p className="text-white/80 text-sm mt-1">Tuzatish va yangi mahsulot so'rovlaringiz holati</p>
      </header>

      <main className="px-4 -mt-4 relative z-10">
        {requests.length === 0 ? (
          <div className="bg-surface rounded-2xl shadow-card p-10 text-center text-muted">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Hozircha so'rov yo'q</p>
            <p className="text-xs mt-1">Mahsulot sahifasida "Tuzatish so'rash" yoki "Yangi mahsulot so'rash" tugmasidan foydalaning.</p>
          </div>
        ) : (
          <div className="space-y-2">
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
          </div>
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
  const { data } = await supabase.from('v_my_requests').select('*')
  return { props: { requests: data ?? [] } }
}
