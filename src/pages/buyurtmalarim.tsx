import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { createServiceClient } from '@/lib/supabase/api'
import { CUSTOMER_COOKIE } from '@/lib/customerAuth'
import { formatUZS, formatDate } from '@/lib/format'
import { ArrowLeft, ChevronRight, ShoppingBag } from 'lucide-react'

type OrderRow = { id: string; status: string; subtotal: number; created_at: string; summary: string }

const LABEL: Record<string, { t: string; cls: string }> = {
  pending_payment:        { t: "To'lov kutilmoqda", cls: 'bg-orange-100 text-warning' },
  awaiting_payment_retry: { t: 'Chek qayta kerak',  cls: 'bg-orange-100 text-warning' },
  rejected:               { t: 'Chek rad etildi',   cls: 'bg-red-100 text-danger' },
  awaiting_confirmation:  { t: 'Tekshirilmoqda',    cls: 'bg-sky/20 text-sky' },
  confirmed:              { t: 'Tasdiqlandi',       cls: 'bg-green-100 text-success' },
  delivering:             { t: 'Yetkazilmoqda',     cls: 'bg-lavender/20 text-lavender' },
  delivered:              { t: 'Yetkazildi',        cls: 'bg-green-100 text-success' },
  cancelled:              { t: 'Bekor qilindi',     cls: 'bg-gray-100 text-muted' },
}

const DONE = ['delivered', 'cancelled']
const TABS = [
  { key: 'active', label: 'Faol' },
  { key: 'done',   label: 'Yakunlangan' },
  { key: 'all',    label: 'Hammasi' },
]

export default function MyOrders({ loggedIn, orders }: { loggedIn: boolean; orders: OrderRow[] }) {
  const [tab, setTab] = useState('active')
  const shown = orders.filter(o => tab === 'all' ? true : tab === 'done' ? DONE.includes(o.status) : !DONE.includes(o.status))
  return (
    <>
      <Head><title>Mening buyurtmalarim — Camelia Korea</title></Head>
      <div className="min-h-screen bg-cream">
        <header className="sticky top-0 z-20 bg-cream/80 backdrop-blur border-b border-black/5">
          <div className="max-w-2xl mx-auto px-5 h-16 flex items-center gap-3">
            <Link href="/" className="text-muted hover:text-ink transition"><ArrowLeft className="w-5 h-5" /></Link>
            <h1 className="font-display font-bold text-ink text-lg">Mening buyurtmalarim</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8">
          {!loggedIn ? (
            <div className="bg-surface rounded-2xl shadow-card p-8 text-center">
              <p className="text-muted">Buyurtmalarni ko'rish uchun avval kiring.</p>
              <Link href="/" className="inline-flex items-center gap-2 mt-4 text-rose font-semibold">Bosh sahifaga qaytish</Link>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card p-8 text-center">
              <ShoppingBag className="w-8 h-8 text-muted mx-auto mb-2" />
              <p className="text-muted">Hali buyurtma yo'q.</p>
              <Link href="/#mahsulotlar" className="inline-flex items-center gap-2 mt-4 text-rose font-semibold">Katalogni ko'rish</Link>
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                {TABS.map(t => {
                  const n = orders.filter(o => t.key === 'all' ? true : t.key === 'done' ? DONE.includes(o.status) : !DONE.includes(o.status)).length
                  return (
                    <button key={t.key} onClick={() => setTab(t.key)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition ${tab === t.key ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'bg-surface text-muted hover:text-ink'}`}>
                      {t.label}{n > 0 && <span className="ml-1.5 opacity-80">{n}</span>}
                    </button>
                  )
                })}
              </div>
              {shown.length === 0 ? (
                <div className="bg-surface rounded-2xl shadow-card p-8 text-center text-muted">Bu bo'limda buyurtma yo'q.</div>
              ) : (
              <div className="space-y-3">
              {shown.map(o => {
                const l = LABEL[o.status] ?? LABEL.pending_payment
                return (
                  <Link key={o.id} href={`/buyurtma/${o.id}`}
                    className="flex items-center gap-3 bg-surface rounded-2xl shadow-card p-4 hover:shadow-rose transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${l.cls}`}>{l.t}</span>
                        <span className="text-xs text-muted">{formatDate(o.created_at)}</span>
                      </div>
                      <p className="text-sm text-ink truncate">{o.summary}</p>
                      <p className="font-display font-bold text-ink mt-0.5">{formatUZS(o.subtotal)}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted flex-shrink-0" />
                  </Link>
                )
              })}
              </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const token = ctx.req.cookies?.[CUSTOMER_COOKIE]
  if (!token) return { props: { loggedIn: false, orders: [] } }

  const supabase = createServiceClient()
  const { data: customer } = await supabase.from('customers').select('id').eq('session_token', token).single()
  if (!customer) return { props: { loggedIn: false, orders: [] } }

  const { data: rows } = await supabase.from('orders')
    .select('id, status, subtotal, created_at').eq('customer_id', customer.id).order('created_at', { ascending: false })
  const list = rows ?? []
  const { data: items } = list.length
    ? await supabase.from('order_items').select('order_id, product_name, qty').in('order_id', list.map(o => o.id))
    : { data: [] as any[] }
  const byOrder = new Map<string, any[]>()
  for (const it of items ?? []) { const a = byOrder.get(it.order_id) ?? []; a.push(it); byOrder.set(it.order_id, a) }

  const orders: OrderRow[] = list.map(o => {
    const its = byOrder.get(o.id) ?? []
    const summary = its.length ? `${its[0].product_name}${its.length > 1 ? ` +${its.length - 1}` : ''}` : '—'
    return { id: o.id, status: o.status, subtotal: o.subtotal, created_at: o.created_at, summary }
  })
  return { props: { loggedIn: true, orders } }
}
