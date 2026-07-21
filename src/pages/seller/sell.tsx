import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS } from '@/lib/format'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import { ChevronLeft, Minus, Plus, Check, Clock } from 'lucide-react'
import { S } from '@/consts/strings'
import { addPending } from '@/lib/pendingSales'

type Product = {
  product_id: string
  product_name: string
  remaining: number
  retail_price: number
  discount_price: number | null
  image_url: string | null
}
type Props = { products: Product[]; sellerId: string; preselectedId: string | null }

const GRADIENTS = ['from-rose to-peach', 'from-lavender to-sky', 'from-mint to-sky', 'from-peach to-rose']

// Photo, or a friendly gradient with the product's initial (no blank boxes).
function Thumb({ p, i, className = '' }: { p: Product; i: number; className?: string }) {
  if (p.image_url) return <img src={p.image_url} alt={p.product_name} className={`object-cover ${className}`} />
  return (
    <div className={`bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} grid place-items-center ${className}`}>
      <span className="font-display font-bold text-white/80 text-3xl">{p.product_name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

function friendlyError(msg?: string) {
  if (!msg) return "Xatolik — qayta urinib ko'ring"
  // DB guard messages are already friendly Uzbek → pass them through; hide raw English.
  if (/mahsulot|yetarli|yo'q|biriktir/i.test(msg)) return msg
  return "Xatolik — qayta urinib ko'ring"
}

export default function Sell({ products, sellerId, preselectedId }: Props) {
  const router = useRouter()
  const inStock = products.filter(p => p.remaining > 0)
  const preOk = preselectedId ? inStock.some(p => p.product_id === preselectedId) : false

  // Two steps (redesign.md §4.2). The home product list IS the picker — there is no
  // standalone grid here any more. Step 1 = qty + price, step 2 = confirm.
  const [step, setStep] = useState<1 | 2 | 3>(preOk ? 2 : 1)
  const [productId, setProductId] = useState(preOk ? preselectedId! : '')
  const [qty, setQty] = useState(1)
  // Default to the discount price when the product has one (pickProduct used to do this).
  const [priceMode, setPriceMode] = useState<'retail' | 'discount' | 'other'>(
    preOk && products.find(p => p.product_id === preselectedId)?.discount_price != null ? 'discount' : 'retail'
  )
  const [customPrice, setCustomPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Result screen: online (with profit + undo) or offline (queued)
  const [result, setResult] = useState<{ profit: number | null; amount: number; saleId: string | null; offline: boolean } | null>(null)
  const [undoSecs, setUndoSecs] = useState(10)

  const selected = products.find(p => p.product_id === productId)
  const idx = Math.max(0, inStock.findIndex(p => p.product_id === productId))
  const price =
    priceMode === 'retail'   ? selected?.retail_price ?? 0 :
    priceMode === 'discount' ? selected?.discount_price ?? selected?.retail_price ?? 0 :
                               Number(customPrice) || 0

  // Count the undo window down, but DO NOT navigate when it ends (redesign.md §4.2):
  // the screen waits for her choice, so the undo is reachable for its full life and
  // she is never bounced away mid-read.
  useEffect(() => {
    if (!result || result.offline || !result.saleId || undoSecs <= 0) return
    const t = setTimeout(() => setUndoSecs(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [result, undoSecs]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!selected || price <= 0) return
    if (qty > selected.remaining) { setError(S.tooMany(selected.remaining)); return }
    setLoading(true); setError('')
    const amount = price * qty
    const payload = { seller_id: sellerId, product_id: productId, qty, unit_price: price, note: null as string | null }

    // No signal → queue locally and show the calm "saved, will send" screen.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      addPending({ ...payload, client_ts: Date.now() })
      setResult({ profit: null, amount, saleId: null, offline: true }); setLoading(false); return
    }

    const supabase = createBrowser()
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from('sales').insert(payload).select('id').single()
      if (insertErr || !inserted) { setError(friendlyError(insertErr?.message)); setLoading(false); return }

      // Profit comes from the view (never computed client-side).
      const { data: sale } = await supabase.from('v_my_sales').select('your_profit').eq('id', inserted.id).single()
      fetch('/api/low-stock-check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, qty }),
      }).catch(() => {})
      if (typeof window !== 'undefined') {
        const confetti = (await import('canvas-confetti')).default
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#F4628E', '#FFB088', '#B9A7F0', '#6FD8C0'] })
      }
      setUndoSecs(10)
      setResult({ profit: sale?.your_profit ?? 0, amount, saleId: inserted.id, offline: false })
      setLoading(false)
    } catch {
      // Network exception mid-request → queue it, never lose the tap.
      addPending({ ...payload, client_ts: Date.now() })
      setResult({ profit: null, amount, saleId: null, offline: true }); setLoading(false)
    }
  }

  async function undo() {
    if (!result?.saleId) return
    const supabase = createBrowser()
    await supabase.from('sales').delete().eq('id', result.saleId)
    router.push('/seller')
  }

  // "Yana sotish" goes back to the home list — the one and only product picker.
  function sellAgain() { router.push('/seller') }

  // ─────────────────────────── Success / offline screen ───────────────────────────
  if (result) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-4">
          {result.offline ? (
            <>
              <div className="w-24 h-24 rounded-full bg-orange-100 grid place-items-center"><Clock className="w-12 h-12 text-warning" /></div>
              <p className="font-display text-2xl font-bold text-ink">{S.offlineSaved}</p>
              <p className="text-sm text-muted max-w-xs">{S.offlineSavedSub}</p>
            </>
          ) : (
            <>
              <div className="w-24 h-24 rounded-full bg-green-100 grid place-items-center"><Check className="w-12 h-12 text-success" /></div>
              <p className="font-display text-2xl font-bold text-ink">{S.saleSuccess}</p>
              <p className="text-sm text-muted">{S.youEarned}</p>
              <p className="font-display text-4xl font-bold text-rose">{formatUZS(result.profit ?? 0)}</p>
              {undoSecs > 0
                ? <button onClick={undo} className="text-sm font-semibold text-muted underline mt-1">{S.undoBtn(undoSecs)}</button>
                : <span className="text-sm text-muted/60 mt-1">{S.undoExpired}</span>}
            </>
          )}
        </div>
        <div className="p-5 space-y-2">
          <button onClick={sellAgain}
            className="w-full bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-4 rounded-full shadow-rose active:scale-95 transition">
            {S.sellAgain}
          </button>
          <button onClick={() => router.push('/seller')} className="w-full text-muted font-medium py-2">{S.goHome}</button>
        </div>
      </div>
    )
  }

  // ─────────────────────────── Header (back + title + step dots) ───────────────────────────
  // Two dots now: qty+price, then confirm.
  const titles = { 1: S.sellStep1, 2: S.sellStep2, 3: S.sellStep3 }
  const Dots = () => (
    <div className="flex gap-1.5 mt-3">
      {[2, 3].map(n => <span key={n} className={`h-1.5 rounded-full transition-all ${n === step ? 'w-6 bg-rose' : 'w-1.5 bg-rose/25'}`} />)}
    </div>
  )
  function back() {
    setError('')
    if (step === 3) setStep(2)
    else router.push('/seller')
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <div className="px-5 pt-8 pb-2">
        <div className="flex items-center gap-3">
          <button aria-label="Orqaga" onClick={back} className="w-9 h-9 rounded-full bg-surface shadow-card grid place-items-center text-ink active:scale-90 transition">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-xl font-bold text-ink">{titles[step]}</h1>
        </div>
        <div className="pl-12"><Dots /></div>
      </div>

      {/* No standalone picker any more — the home list is step 0. Landing here without
          a product (old link / bookmark) just sends her back to it. */}
      {step === 1 && (
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="bg-surface rounded-2xl shadow-card p-8 text-center">
            <p className="text-sm text-muted mb-4">{S.pickFromHome}</p>
            <button onClick={() => router.push('/seller')}
              className="bg-gradient-to-br from-rose to-peach text-white font-display font-bold px-6 py-3 rounded-full shadow-rose active:scale-95 transition">
              {S.goHome}
            </button>
          </div>
        </main>
      )}

      {/* ── Step 2 — quantity + price ── */}
      {step === 2 && selected && (
        <>
          <main className="flex-1 overflow-y-auto px-5 py-4 space-y-7">
            <div className="flex items-center gap-3 bg-surface rounded-full shadow-card px-3 py-2 w-fit">
              <Thumb p={selected} i={idx} className="w-9 h-9 rounded-full" />
              <span className="font-display font-semibold text-ink text-sm pr-2">{selected.product_name}</span>
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-center gap-8">
              <button aria-label="Kamaytirish" onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-16 h-16 rounded-full bg-cream text-ink grid place-items-center text-3xl active:scale-90 transition shadow-card">
                <Minus className="w-7 h-7" />
              </button>
              <span className="font-display text-5xl font-bold text-ink w-16 text-center">{qty}</span>
              <button aria-label="Ko'paytirish" onClick={() => setQty(q => Math.min(selected.remaining, q + 1))}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-rose to-peach text-white grid place-items-center active:scale-90 transition shadow-rose">
                <Plus className="w-7 h-7" />
              </button>
            </div>
            <p className="text-center text-xs text-muted -mt-4">Max: {selected.remaining} ta</p>

            {/* Price presets with real amounts */}
            <div className="space-y-2.5">
              <button onClick={() => setPriceMode('retail')}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl font-display font-semibold transition active:scale-[0.98] ${priceMode === 'retail' ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'bg-surface text-ink shadow-card'}`}>
                <span>{S.fullPrice}</span><span>{formatUZS(selected.retail_price)}</span>
              </button>
              {selected.discount_price != null && (
                <button onClick={() => setPriceMode('discount')}
                  className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl font-display font-semibold transition active:scale-[0.98] ${priceMode === 'discount' ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'bg-surface text-ink shadow-card'}`}>
                  <span>{S.discountPrice}</span><span>{formatUZS(selected.discount_price)}</span>
                </button>
              )}
              <button onClick={() => setPriceMode('other')}
                className={`w-full text-center px-5 py-4 rounded-2xl font-display font-semibold transition active:scale-[0.98] ${priceMode === 'other' ? 'bg-gradient-to-br from-rose to-peach text-white shadow-rose' : 'bg-surface text-muted shadow-card'}`}>
                {S.otherPrice}
              </button>
              {priceMode === 'other' && (
                <input type="number" inputMode="numeric" value={customPrice} onChange={e => setCustomPrice(e.target.value)}
                  placeholder={S.pricePlaceholder} autoFocus
                  className="w-full bg-surface text-ink text-center font-display font-bold text-xl rounded-2xl px-4 py-4 shadow-card focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
              )}
            </div>

            {/* Live total */}
            {price > 0 && (
              <div className="bg-surface rounded-2xl shadow-card p-5 text-center">
                <p className="text-xs font-semibold text-muted">{S.total}</p>
                <p className="font-display text-3xl font-bold text-rose mt-1">{formatUZS(price * qty)}</p>
              </div>
            )}
            {error && <p className="text-danger text-sm text-center bg-red-50 rounded-xl py-3">{error}</p>}
          </main>
          <div className="p-5">
            <button onClick={() => { setError(''); setStep(3) }} disabled={price <= 0}
              className="w-full bg-gradient-to-br from-rose to-peach text-white font-display font-bold text-lg py-4 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50">
              {S.continueBtn}
            </button>
          </div>
        </>
      )}

      {/* ── Step 3 — review & confirm ── */}
      {step === 3 && selected && (
        <>
          <main className="flex-1 overflow-y-auto px-5 py-4 flex items-center justify-center">
            <div className="bg-surface rounded-3xl shadow-card p-6 w-full max-w-xs flex flex-col items-center text-center gap-4">
              <Thumb p={selected} i={idx} className="w-32 h-32 rounded-2xl" />
              <p className="text-base text-ink leading-relaxed">
                {S.reviewLine(qty, selected.product_name, formatUZS(price * qty))}
              </p>
            </div>
          </main>
          {error && <p className="text-danger text-sm text-center bg-red-50 mx-5 rounded-xl py-3 mb-2">{error}</p>}
          <div className="p-5 space-y-2.5">
            <button onClick={submit} disabled={loading}
              className="w-full bg-gradient-to-br from-rose to-peach text-white font-display font-bold text-lg py-4 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50">
              {loading ? S.saving : S.confirmYes}
            </button>
            <button onClick={() => { setError(''); setStep(2) }} className="w-full bg-surface text-ink font-display font-semibold py-3.5 rounded-full shadow-card active:scale-95 transition">
              {S.confirmNo}
            </button>
          </div>
        </>
      )}
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

  // v_my_inventory = RLS-safe list for sellers; prices/photo from v_catalog (definer), keyed by id.
  const [invRes, catalogRes] = await Promise.all([
    supabase.from('v_my_inventory').select('product_id, product_name, remaining').order('product_name'),
    supabase.from('v_catalog').select('id, retail_price, discount_price, image_url'),
  ])
  const catMap = Object.fromEntries((catalogRes.data ?? []).map((c: any) => [c.id, c]))

  const products: Product[] = (invRes.data ?? []).map(i => ({
    product_id:     i.product_id,
    product_name:   i.product_name,
    remaining:      i.remaining,
    retail_price:   catMap[i.product_id]?.retail_price ?? 0,
    discount_price: catMap[i.product_id]?.discount_price ?? null,
    image_url:      catMap[i.product_id]?.image_url ?? null,
  }))

  const preselectedId = typeof ctx.query.product === 'string' ? ctx.query.product : null

  return { props: { products, sellerId: profile!.id, preselectedId } }
}
