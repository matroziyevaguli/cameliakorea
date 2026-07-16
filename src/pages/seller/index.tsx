import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS } from '@/lib/format'
import Link from 'next/link'
import { useState, useRef } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import { useRouter } from 'next/router'
import { ShoppingBag, LogOut, History, Wallet, TrendingUp, Send, X } from 'lucide-react'
import { S } from '@/consts/strings'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const UZ_MONTHS: Record<string, string> = {
  Jan:'Yan', Feb:'Fev', Mar:'Mar', Apr:'Apr', May:'May', Jun:'Iyn',
  Jul:'Iyl', Aug:'Avg', Sep:'Sen', Oct:'Okt', Nov:'Noy', Dec:'Dek',
}
const CARD_COLORS = ['#F4628E','#B9A7F0','#6FD8C0','#7CC4F2','#FFB088','#E14B79']

type Summary = { your_total_profit: number; total_owed: number; submitted: number; not_submitted: number }
type Monthly  = { month: string; month_label: string; your_profit: number; units_sold: number }
type Product  = {
  product_id: string; name: string; retail_price: number; discount_price: number | null
  image_url: string | null; description: string | null; link: string | null; gallery: string[]
  had: number; sold: number; remaining: number
}
type Props = { sellerName: string; summary: Summary | null; monthly: Monthly[]; products: Product[]; thisMonthProfit: number }

function RemainingBadge({ n }: { n: number }) {
  if (n === 0) return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-danger">Tugadi</span>
  if (n <= 2)  return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-warning">{S.remaining(n)}</span>
  return               <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-success">{S.remaining(n)}</span>
}

// Swipeable image gallery: cover first, then gallery photos. Scroll-snap + dots. Lazy-loaded.
function ImageGallery({ images, name, colorIndex, badge }: { images: string[]; name: string; colorIndex: number; badge: React.ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  function onScroll() {
    const el = scrollerRef.current
    if (!el) return
    setActive(Math.round(el.scrollLeft / el.clientWidth))
  }

  // No images → letter placeholder
  if (images.length === 0) {
    return (
      <div className="relative h-44 overflow-hidden">
        <div className="w-full h-full flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${CARD_COLORS[colorIndex % CARD_COLORS.length]}30, ${CARD_COLORS[(colorIndex+1) % CARD_COLORS.length]}50)` }}>
          <span className="font-display font-bold text-8xl select-none opacity-60"
            style={{ color: CARD_COLORS[colorIndex % CARD_COLORS.length] }}>
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="absolute top-3 right-3">{badge}</div>
      </div>
    )
  }

  return (
    <div className="relative h-44 overflow-hidden">
      <div ref={scrollerRef} onScroll={onScroll}
        className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}>
        {images.map((src, i) => (
          <img key={i} src={src} alt={`${name} ${i + 1}`} loading="lazy"
            className="w-full h-full object-cover flex-shrink-0 snap-center" style={{ minWidth: '100%' }} />
        ))}
      </div>

      <div className="absolute top-3 right-3">{badge}</div>

      {images.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {images.map((_, i) => (
            <span key={i} className={`rounded-full transition-all ${active === i ? 'bg-white w-4 h-1.5' : 'bg-white/50 w-1.5 h-1.5'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

function buildCaption(p: Product) {
  const price = p.discount_price != null
    ? `💰 Narxi: ${formatUZS(p.retail_price)}\n🏷️ Chegirma: ${formatUZS(p.discount_price)}`
    : `💰 Narxi: ${formatUZS(p.retail_price)}`
  const desc = p.description ? `\n\n${p.description}` : ''
  return `✨ Yangi mahsulot!\n\n${p.name}\n${price}${desc}\n\n⚠️ Mahsulot soni cheklangan!\n\n🇰🇷 Koreyadan, sinab ko'rilgan\n📍 O'zbekistonda mavjud\n\n📞 Buyurtma uchun:\n🏙 Namangan: Gulshanoy +998 94 099 44 99\n🏙 Andijon: Saida +998 93 858 27 27\n🏙 Farg'ona: Adolat +998 33 408 61 83\n\n@cameliakorea`
}

export default function SellerHome({ sellerName, summary, monthly, products, thisMonthProfit }: Props) {
  const router = useRouter()

  // Telegram post sheet
  const [postProduct, setPostProduct] = useState<Product | null>(null)
  const [caption, setCaption] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [postDone, setPostDone] = useState(false)

  function openPost(p: Product) {
    setPostProduct(p); setCaption(buildCaption(p)); setPostError(''); setPostDone(false)
  }

  async function sendPost() {
    if (!postProduct?.image_url) return
    setPosting(true); setPostError('')
    const res = await fetch('/api/announce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: postProduct.image_url, caption, link: postProduct.link }),
    })
    const json = await res.json()
    setPosting(false)
    if (!res.ok) { setPostError(json.error ?? 'Xatolik'); return }
    setPostDone(true)
    setTimeout(() => setPostProduct(null), 1400)
  }

  async function signOut() {
    const supabase = createBrowser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const chartData = monthly.map(m => ({
    label: UZ_MONTHS[m.month_label] ?? m.month_label,
    foyda: Math.round(m.your_profit),
  }))

  return (
    <div className="min-h-screen bg-cream pb-28">

      {/* ── Header ── */}
      <header className="bg-gradient-to-br from-rose to-peach text-white px-5 pt-10 pb-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/3" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-white/70 text-sm font-medium">Camelia</p>
            <h1 className="font-display text-2xl font-bold mt-1">{S.greeting(sellerName)}</h1>
            <p className="text-white/80 text-sm mt-2">
              Bu oy foydangiz:{' '}
              <span className="font-display font-bold text-white text-base">{formatUZS(thisMonthProfit)}</span>
            </p>
          </div>
          <button onClick={signOut} className="text-white/70 hover:text-white p-2 transition">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-4 -mt-12 relative z-10 space-y-4">

        {/* ── Money box ── */}
        {summary && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-2xl shadow-card p-4">
              <p className="text-xs font-semibold text-muted mb-2">Topshirilishi kerak</p>
              <p className={`font-display text-xl font-bold ${summary.not_submitted > 0 ? 'text-danger' : 'text-success'}`}>
                {formatUZS(summary.not_submitted)}
              </p>
            </div>
            <div className="bg-surface rounded-2xl shadow-card p-4">
              <p className="text-xs font-semibold text-muted mb-2">Topshirilgan</p>
              <p className="font-display text-xl font-bold text-success">{formatUZS(summary.submitted)}</p>
            </div>
          </div>
        )}

        {/* ── Monthly chart ── */}
        {chartData.length > 0 && (
          <div className="bg-surface rounded-2xl shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-rose" />
              <h2 className="font-display font-bold text-ink text-base">Oylik foyda</h2>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ left: -10, right: 0 }}>
                <XAxis dataKey="label" tick={{ fill: '#8A7F8C', fontSize: 11 }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(244,98,142,0.15)', fontSize: 12 }}
                  formatter={(v) => [formatUZS(Number(v)), 'Foyda']}
                />
                <Bar dataKey="foyda" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={CARD_COLORS[i % CARD_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Product cards ── */}
        <div>
          <h2 className="font-display font-bold text-ink text-base mb-3 px-1">{S.myProducts}</h2>
          {products.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card p-10 text-center text-muted">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{S.noProducts}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((p, i) => (
                <div key={p.product_id} className="bg-surface rounded-2xl shadow-card overflow-hidden">

                  {/* Swipeable gallery: cover first, then result photos */}
                  <ImageGallery
                    images={[...(p.image_url ? [p.image_url] : []), ...p.gallery]}
                    name={p.name}
                    colorIndex={i}
                    badge={<RemainingBadge n={p.remaining} />}
                  />

                  <div className="p-4">
                    <h3 className="font-display font-semibold text-ink text-base leading-snug">{p.name}</h3>

                    {/* Price */}
                    <div className="flex items-center gap-3 mt-1 mb-2">
                      {p.discount_price != null ? (
                        <>
                          <span className="text-xs text-muted line-through">{formatUZS(p.retail_price)}</span>
                          <span className="text-sm font-bold text-rose">{formatUZS(p.discount_price)}</span>
                        </>
                      ) : (
                        <span className="text-sm font-bold text-ink">{formatUZS(p.retail_price)}</span>
                      )}
                    </div>

                    {/* Description */}
                    {p.description && (
                      <p className="text-xs text-muted leading-relaxed mb-3 line-clamp-3">{p.description}</p>
                    )}

                    {/* Stock info */}
                    <div className="flex gap-3 text-xs text-muted mb-4">
                      <span>Berilgan: <strong className="text-ink">{p.had}</strong></span>
                      <span>Sotilgan: <strong className="text-success">{p.sold}</strong></span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {p.remaining > 0 && (
                        <Link href={`/seller/sell?product=${p.product_id}`}
                          className="flex-1 bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-3 rounded-full text-sm text-center shadow-rose active:scale-95 transition">
                          {S.soldBtn}
                        </Link>
                      )}
                      {p.link && (
                        <a href={p.link} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-red-50 text-red-600 text-sm font-semibold active:scale-95 transition border border-red-100">
                          ▶️ Videoni ko'rish
                        </a>
                      )}
                      {p.image_url && (
                        <button onClick={() => openPost(p)}
                          className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-gradient-to-br from-sky/20 to-lavender/20 text-ink text-sm font-semibold active:scale-95 transition border border-lavender/30">
                          <Send className="w-4 h-4 text-lavender" />
                          Post
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-100 flex z-20 shadow-card">
        <Link href="/seller" className="flex-1 flex flex-col items-center gap-1 py-3 text-rose">
          <ShoppingBag className="w-5 h-5" /><span className="text-xs font-medium">Mahsulotlar</span>
        </Link>
        <Link href="/seller/sales" className="flex-1 flex flex-col items-center gap-1 py-3 text-muted hover:text-rose transition">
          <History className="w-5 h-5" /><span className="text-xs font-medium">Tarix</span>
        </Link>
        <Link href="/seller/balance" className="flex-1 flex flex-col items-center gap-1 py-3 text-muted hover:text-rose transition">
          <Wallet className="w-5 h-5" /><span className="text-xs font-medium">Hisobim</span>
        </Link>
      </nav>

      {/* ── Telegram post sheet ── */}
      {postProduct && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPostProduct(null)} />
          <div className="relative bg-surface rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-bold text-ink text-base">📢 Kanalga yuborish</p>
              <button onClick={() => setPostProduct(null)} className="text-muted hover:text-ink transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview */}
            <div className="flex gap-3 mb-4">
              {postProduct.image_url && (
                <img src={postProduct.image_url} alt={postProduct.name}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-sm" />
              )}
              <div>
                <p className="font-semibold text-ink text-sm">{postProduct.name}</p>
                <p className="text-xs text-muted mt-0.5">@cameliakorea kanaliga yuboriladi</p>
              </div>
            </div>

            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={12}
              className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-lavender border-2 border-transparent transition resize-none"
            />

            {postError && <p className="text-danger text-xs mt-2">{postError}</p>}

            {postDone ? (
              <div className="mt-3 text-center py-3 rounded-full bg-green-50 text-success font-semibold text-sm">
                ✅ Kanalga yuborildi!
              </div>
            ) : (
              <button onClick={sendPost} disabled={posting || !caption.trim()}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-gradient-to-br from-sky to-lavender text-white font-display font-bold py-4 rounded-full active:scale-95 transition disabled:opacity-50 shadow-sm">
                <Send className="w-5 h-5" />
                {posting ? 'Yuborilmoqda…' : 'Yuborish'}
              </button>
            )}
          </div>
        </div>
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
    .from('profiles').select('id, full_name').eq('user_id', session!.user.id).single()

  // Product list: v_my_inventory (RLS-safe for sellers — v_inventory & the products table
  // both return 0 rows to sellers). Prices/images/gallery: v_catalog (a definer view sellers
  // CAN read), keyed by `id` = product_id.
  const [summaryRes, monthlyRes, invRes, catalogRes] = await Promise.all([
    supabase.from('v_my_summary').select('*').maybeSingle(),
    supabase.from('v_my_monthly').select('*'),
    supabase.from('v_my_inventory').select('product_id, product_name, had, sold, remaining'),
    supabase.from('v_catalog').select('id, retail_price, discount_price, image_url, description, link, gallery'),
  ])

  const inv = invRes.data ?? []
  const catMap = Object.fromEntries((catalogRes.data ?? []).map((c: any) => [c.id, c]))

  const products: Product[] = inv.map(i => {
    const c: any = catMap[i.product_id] ?? {}
    return {
      product_id:     i.product_id,
      name:           i.product_name,
      retail_price:   c.retail_price ?? 0,
      discount_price: c.discount_price ?? null,
      image_url:      c.image_url ?? null,
      description:    c.description ?? null,
      link:           c.link ?? null,
      gallery:        Array.isArray(c.gallery) ? c.gallery : [],
      had:            i.had,
      sold:           i.sold,
      remaining:      i.remaining,
    }
  })

  const currentMonth = new Date().toISOString().slice(0, 7)
  const thisMonthProfit = (monthlyRes.data ?? []).find(m => m.month === currentMonth)?.your_profit ?? 0

  return {
    props: {
      sellerName:     profile?.full_name ?? '',
      summary:        summaryRes.data ?? null,
      monthly:        monthlyRes.data ?? [],
      products,
      thisMonthProfit,
    }
  }
}
