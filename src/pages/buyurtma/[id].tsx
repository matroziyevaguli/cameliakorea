import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { createServiceClient } from '@/lib/supabase/api'
import { CUSTOMER_COOKIE } from '@/lib/customerAuth'
import { compressImage } from '@/lib/image'
import { formatUZS } from '@/lib/format'
import { CITY_LABEL } from '@/consts/geo'
import CardPreview from '@/components/CardPreview'
import { ArrowLeft, Upload, Loader2, CheckCircle, Clock, Truck, XCircle, CreditCard } from 'lucide-react'

type Item = { product_name: string; unit_price: number; qty: number }
type Seller = { name: string | null; card_number: string | null; card_holder: string | null } | null
type Order = {
  id: string; status: string; subtotal: number; city: string; address: string
  contact_name: string; contact_phone: string; rejection_reason: string | null; created_at: string
}

const STATUS: Record<string, { label: string; cls: string; icon: any; msg: string }> = {
  pending_payment:        { label: "To'lov kutilmoqda", cls: 'bg-orange-100 text-warning', icon: Clock,      msg: "Kartaga o'tkazing va chek rasmini yuklang." },
  awaiting_payment_retry: { label: 'Chek qayta kerak',  cls: 'bg-orange-100 text-warning', icon: Clock,      msg: 'Chek qabul qilinmadi — qaytadan yuklang.' },
  rejected:               { label: 'Chek rad etildi',   cls: 'bg-red-100 text-danger',     icon: XCircle,    msg: 'Chek qabul qilinmadi — qaytadan yuklang.' },
  awaiting_confirmation:  { label: 'Tekshirilmoqda',    cls: 'bg-sky/20 text-sky',         icon: Clock,      msg: 'Chek yuborildi. Admin tasdiqlashini kuting.' },
  confirmed:              { label: 'Tasdiqlandi',       cls: 'bg-green-100 text-success',  icon: CheckCircle, msg: "To'lov qabul qilindi. Buyurtma tayyorlanmoqda." },
  delivering:             { label: 'Yetkazilmoqda',     cls: 'bg-lavender/20 text-lavender', icon: Truck,    msg: "Buyurtmangiz yo'lda." },
  delivered:              { label: 'Yetkazildi',        cls: 'bg-green-100 text-success',  icon: CheckCircle, msg: 'Rahmat! Buyurtma yetkazildi.' },
  cancelled:              { label: 'Bekor qilindi',     cls: 'bg-gray-100 text-muted',     icon: XCircle,    msg: 'Buyurtma bekor qilindi.' },
}

export default function OrderStatus({ order, items, seller }: { order: Order; items: Item[]; seller: Seller }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const meta = STATUS[order.status] ?? STATUS.pending_payment
  const Icon = meta.icon
  const canUpload = ['pending_payment', 'awaiting_payment_retry', 'rejected', 'awaiting_confirmation'].includes(order.status)

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setBusy(true); setError('')
    try {
      const blob = await compressImage(file, 1280, 0.8)
      const base64: string = await new Promise((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(blob)
      })
      const res = await fetch('/api/orders/receipt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, imageBase64: base64 }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Xatolik'); setBusy(false); return }
      router.replace(router.asPath)   // refresh SSR
    } catch { setError('Rasmni yuklab bo\'lmadi'); setBusy(false) }
  }

  return (
    <>
      <Head><title>Buyurtma — Camelia Korea</title></Head>
      <div className="min-h-screen bg-cream">
        <header className="sticky top-0 z-20 bg-cream/80 backdrop-blur border-b border-black/5">
          <div className="max-w-2xl mx-auto px-5 h-16 flex items-center gap-3">
            <Link href="/" className="text-muted hover:text-ink transition"><ArrowLeft className="w-5 h-5" /></Link>
            <h1 className="font-display font-bold text-ink text-lg">Buyurtma</h1>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-5 py-8 space-y-6">
          {/* Status */}
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <span className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full ${meta.cls}`}>
              <Icon className="w-4 h-4" /> {meta.label}
            </span>
            <p className="text-muted mt-3">{meta.msg}</p>
            {order.rejection_reason && (order.status === 'rejected' || order.status === 'awaiting_payment_retry') && (
              <p className="text-sm text-danger mt-2">Sabab: {order.rejection_reason}</p>
            )}
          </div>

          {/* Payment */}
          {canUpload && (
            <div className="bg-surface rounded-2xl shadow-card p-6">
              <h2 className="font-display font-bold text-ink mb-3 flex items-center gap-2"><CreditCard className="w-5 h-5 text-rose" /> To'lov</h2>
              {seller?.card_number ? (
                <div className="mb-4">
                  <p className="text-xs text-muted mb-2">Ushbu kartaga o'tkazing:</p>
                  <CardPreview number={seller.card_number} holder={seller.card_holder} />
                  <p className="text-sm mt-3 text-center">Summa: <b className="text-ink text-base">{formatUZS(order.subtotal)}</b></p>
                </div>
              ) : (
                <p className="text-sm text-warning bg-orange-50 rounded-xl px-4 py-3 mb-4">Karta hali sozlanmagan — iltimos Telegram orqali bog'laning.</p>
              )}
              <label className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-sky to-lavender text-white font-semibold py-3.5 rounded-full active:scale-95 transition cursor-pointer">
                {busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Yuklanmoqda…</> : <><Upload className="w-5 h-5" /> {order.status === 'awaiting_confirmation' ? 'Chekni qayta yuklash' : 'Chek rasmini yuklash'}</>}
                <input type="file" accept="image/*" onChange={upload} disabled={busy} className="hidden" />
              </label>
              {error && <p className="text-danger text-sm mt-2">{error}</p>}
            </div>
          )}

          {/* Items */}
          <div className="bg-surface rounded-2xl shadow-card p-6">
            <h2 className="font-display font-bold text-ink mb-3">Mahsulotlar</h2>
            <div className="divide-y divide-black/5">
              {items.map((i, k) => (
                <div key={k} className="flex justify-between py-2.5 text-sm">
                  <span className="text-ink">{i.product_name} <span className="text-muted">× {i.qty}</span></span>
                  <span className="font-semibold text-ink">{formatUZS(i.unit_price * i.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 font-display font-bold text-ink">
                <span>Jami</span><span>{formatUZS(order.subtotal)}</span>
              </div>
            </div>
            <div className="text-sm text-muted mt-4 space-y-0.5">
              <p>{order.contact_name} · {order.contact_phone}</p>
              <p>{CITY_LABEL[order.city] ?? order.city}, {order.address}</p>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const id = ctx.params?.id as string
  const token = ctx.req.cookies?.[CUSTOMER_COOKIE]
  if (!token) return { notFound: true }

  const supabase = createServiceClient()
  const { data: customer } = await supabase.from('customers').select('id').eq('session_token', token).single()
  if (!customer) return { notFound: true }

  const { data: order } = await supabase.from('orders')
    .select('id, status, subtotal, city, address, contact_name, contact_phone, rejection_reason, created_at, customer_id, assigned_seller_id')
    .eq('id', id).single()
  if (!order || order.customer_id !== customer.id) return { notFound: true }

  const { data: items } = await supabase.from('order_items')
    .select('product_name, unit_price, qty').eq('order_id', id)

  let seller: Seller = null
  if (order.assigned_seller_id) {
    const { data: s } = await supabase.from('profiles')
      .select('full_name, card_number, card_holder').eq('id', order.assigned_seller_id).single()
    if (s) seller = { name: s.full_name, card_number: s.card_number, card_holder: s.card_holder }
  }

  const { customer_id, assigned_seller_id, ...safe } = order as any
  return { props: { order: safe, items: items ?? [], seller } }
}
