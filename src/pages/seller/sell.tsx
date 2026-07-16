import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS } from '@/lib/format'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import { ChevronLeft, Minus, Plus, CheckCircle, Sparkles } from 'lucide-react'
import { S } from '@/consts/strings'

type Product = {
  product_id: string
  product_name: string
  remaining: number
  retail_price: number
  discount_price: number | null
}

type Props = { products: Product[]; sellerId: string; preselectedId: string | null }

export default function Sell({ products, sellerId, preselectedId }: Props) {
  const router = useRouter()
  const [productId, setProductId] = useState(preselectedId ?? '')
  const [qty, setQty] = useState(1)
  const [priceMode, setPriceMode] = useState<'retail' | 'discount' | 'other'>('retail')
  const [customPrice, setCustomPrice] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successProfit, setSuccessProfit] = useState<number | null>(null)

  const selected = products.find(p => p.product_id === productId)

  const price =
    priceMode === 'retail'   ? selected?.retail_price ?? 0 :
    priceMode === 'discount' ? selected?.discount_price ?? selected?.retail_price ?? 0 :
                               Number(customPrice) || 0

  useEffect(() => {
    if (selected) {
      setQty(1)
      // If the product has a discount (chegirma) price, default to it; otherwise full price.
      setPriceMode(selected.discount_price != null ? 'discount' : 'retail')
    }
  }, [productId])

  async function submit() {
    if (!selected || price <= 0) return
    if (qty > selected.remaining) { setError(S.tooMany(selected.remaining)); return }
    setLoading(true); setError('')

    const supabase = createBrowser()

    const { data: inserted, error: insertErr } = await supabase
      .from('sales')
      .insert({ seller_id: sellerId, product_id: productId, qty, unit_price: price, note: note || null })
      .select('id')
      .single()

    if (insertErr || !inserted) { setError(insertErr?.message ?? 'Xatolik'); setLoading(false); return }

    // Read profit from v_my_sales (never compute client-side)
    const { data: sale } = await supabase
      .from('v_my_sales')
      .select('your_profit')
      .eq('id', inserted.id)
      .single()

    // Low-stock alert to the owner (fire-and-forget — never blocks the sale)
    fetch('/api/low-stock-check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, qty }),
    }).catch(() => {})

    // Confetti
    if (typeof window !== 'undefined') {
      const confetti = (await import('canvas-confetti')).default
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#F4628E','#FFB088','#B9A7F0','#6FD8C0'] })
    }

    setSuccessProfit(sale?.your_profit ?? 0)
    setLoading(false)
    setTimeout(() => router.push('/seller'), 2200)
  }

  // ── Success screen ──
  if (successProfit !== null) return (
    <div className="min-h-screen bg-gradient-to-br from-rose to-peach flex flex-col items-center justify-center p-8 text-center">
      <div className="bg-surface rounded-3xl shadow-rose p-10 max-w-xs w-full">
        <div className="w-16 h-16 bg-gradient-to-br from-rose to-peach rounded-full flex items-center justify-center mx-auto mb-5 shadow-rose">
          <CheckCircle className="w-8 h-8 text-white" />
        </div>
        <p className="font-display text-xl font-bold text-ink mb-2">{S.saleSuccess}</p>
        <p className="text-muted text-sm mb-4">Siz</p>
        <p className="font-display text-4xl font-bold text-rose">{formatUZS(successProfit)}</p>
        <p className="font-display text-lg font-semibold text-ink mt-1">foyda oldingiz 🎉</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-gradient-to-br from-rose to-peach text-white px-5 pt-10 pb-14 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/4" />
        <button onClick={() => router.back()} className="relative flex items-center gap-1.5 text-white/80 hover:text-white mb-5 transition">
          <ChevronLeft className="w-5 h-5" /><span className="text-sm">Orqaga</span>
        </button>
        <h1 className="font-display text-2xl font-bold relative">{S.addSale}</h1>
      </header>

      <main className="px-4 -mt-6 pb-10 space-y-4 relative z-10">

        {/* Product picker */}
        <div className="bg-surface rounded-2xl shadow-card p-5">
          <label className="block text-sm font-semibold text-muted mb-2">Mahsulot</label>
          <select
            value={productId}
            onChange={e => setProductId(e.target.value)}
            className="w-full bg-cream text-ink rounded-xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition"
          >
            <option value="">{S.pickProduct}</option>
            {products.filter(p => p.remaining > 0).map(p => (
              <option key={p.product_id} value={p.product_id}>
                {p.product_name} ({p.remaining} ta qoldi)
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <>
            {/* Qty stepper */}
            <div className="bg-surface rounded-2xl shadow-card p-5">
              <label className="block text-sm font-semibold text-muted mb-4">{S.quantity}</label>
              <div className="flex items-center justify-center gap-6">
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-14 h-14 rounded-full bg-cream text-rose flex items-center justify-center active:scale-90 transition">
                  <Minus className="w-6 h-6" />
                </button>
                <span className="font-display text-5xl font-bold text-ink w-16 text-center">{qty}</span>
                <button onClick={() => setQty(q => Math.min(selected.remaining, q + 1))}
                  className="w-14 h-14 rounded-full bg-gradient-to-br from-rose to-peach text-white flex items-center justify-center active:scale-90 transition shadow-rose">
                  <Plus className="w-6 h-6" />
                </button>
              </div>
              <p className="text-center text-xs text-muted mt-3">Max: {selected.remaining} ta</p>
            </div>

            {/* Price selector */}
            <div className="bg-surface rounded-2xl shadow-card p-5">
              <label className="block text-sm font-semibold text-muted mb-3">Narx</label>
              <div className={`grid gap-2 ${selected.discount_price != null ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {[
                  { mode: 'retail' as const, label: S.fullPrice, sub: formatUZS(selected.retail_price) },
                  ...(selected.discount_price != null ? [{ mode: 'discount' as const, label: S.discountPrice, sub: formatUZS(selected.discount_price) }] : []),
                  { mode: 'other' as const, label: S.otherPrice, sub: '' },
                ].map(btn => (
                  <button key={btn.mode} onClick={() => setPriceMode(btn.mode)}
                    className={`py-4 rounded-xl text-sm font-display font-semibold transition active:scale-95 ${priceMode === btn.mode ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'bg-cream text-ink'}`}>
                    <div>{btn.label}</div>
                    {btn.sub && <div className="text-xs opacity-75 mt-0.5">{btn.sub}</div>}
                  </button>
                ))}
              </div>
              {priceMode === 'other' && (
                <input type="number" value={customPrice} onChange={e => setCustomPrice(e.target.value)}
                  placeholder={S.pricePlaceholder}
                  className="mt-3 w-full bg-cream text-ink rounded-xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
              )}
            </div>

            {/* Note */}
            <div className="bg-surface rounded-2xl shadow-card p-5">
              <label className="block text-sm font-semibold text-muted mb-2">{S.note}</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)}
                placeholder={S.notePlaceholder}
                className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent transition" />
            </div>

            {/* Total */}
            {price > 0 && (
              <div className="bg-gradient-to-br from-rose/10 to-peach/10 rounded-2xl p-5 flex justify-between items-center">
                <span className="font-semibold text-ink">{S.total}</span>
                <span className="font-display text-2xl font-bold text-rose">{formatUZS(price * qty)}</span>
              </div>
            )}

            {error && <div className="bg-red-50 text-danger text-sm text-center py-3 rounded-xl">{error}</div>}

            <button onClick={submit} disabled={loading || price <= 0}
              className="w-full bg-gradient-to-br from-rose to-peach text-white font-display font-bold text-xl py-5 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              {loading ? S.saving : S.confirm}
            </button>
          </>
        )}
      </main>
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

  // v_my_inventory = RLS-safe product list for sellers (v_inventory & products table return
  // 0 rows to sellers). Prices from v_catalog (definer view sellers CAN read), keyed by id.
  const [invRes, catalogRes] = await Promise.all([
    supabase.from('v_my_inventory').select('product_id, product_name, remaining').order('product_name'),
    supabase.from('v_catalog').select('id, retail_price, discount_price'),
  ])
  const priceMap = Object.fromEntries((catalogRes.data ?? []).map((c: any) => [c.id, c]))

  const products: Product[] = (invRes.data ?? []).map(i => ({
    product_id:     i.product_id,
    product_name:   i.product_name,
    retail_price:   priceMap[i.product_id]?.retail_price ?? 0,
    discount_price: priceMap[i.product_id]?.discount_price ?? null,
    remaining:      i.remaining,
  }))

  const preselectedId = typeof ctx.query.product === 'string' ? ctx.query.product : null

  return { props: { products, sellerId: profile!.id, preselectedId } }
}
