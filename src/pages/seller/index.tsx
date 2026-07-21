import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { formatUZS } from '@/lib/format'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import { useRouter } from 'next/router'
import SellerNav from '@/components/SellerNav'
import { ShoppingBag, TrendingUp, Send, X, Settings, Search, CalendarClock, Pencil, ClipboardList, Plus, HelpCircle, HandHeart, Receipt, ChevronDown, PlayCircle, RotateCcw } from 'lucide-react'
import HelpSheet from '@/components/HelpSheet'
import NotificationBell from '@/components/NotificationBell'
import { getPending, flushPending } from '@/lib/pendingSales'
import { S } from '@/consts/strings'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { expiryInfo, EXPIRY_LABEL } from '@/lib/expiry'
import { stateOf, STATE_STYLE, sellerLabel } from '@/lib/availability'

// Uzbek month names by number (1–12). v_my_monthly returns month as "YYYY-MM".
const UZ_MONTH_BY_NUM = ['', 'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']
function uzMonth(month: string): string {
  const n = parseInt((month || '').slice(5, 7), 10)   // "2026-07" → 7
  return UZ_MONTH_BY_NUM[n] ?? month
}
const CARD_COLORS = ['#F4628E','#B9A7F0','#6FD8C0','#7CC4F2','#FFB088','#E14B79']

type Summary = { your_total_profit: number; total_owed: number; submitted: number; not_submitted: number }
type Monthly  = { month: string; your_profit: number; units_sold: number }
type Product  = {
  product_id: string; name: string; retail_price: number; discount_price: number | null
  image_url: string | null; description: string | null; link: string | null; gallery: string[]
  expiry_date: string | null
  had: number; sold: number; remaining: number
  state?: string | null; incoming_qty?: number | null   // present once D4/D5 are run
}
type MyRequest = {
  id: string; product_id: string; product_name: string
  current_qty: number; requested_qty: number; reason: string | null
  status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string
}
type Available = { id: string; name: string; retail_price: number; discount_price: number | null }
type Props = { sellerName: string; summary: Summary | null; monthly: Monthly[]; products: Product[]; thisMonthProfit: number; requests: MyRequest[]; available: Available[]; totalUnitsSold: number; totalRevenue: number }

// The card's ONE stock signal, from the shared vocabulary (src/lib/availability.ts) —
// the same words the customer sees on the storefront.
function StockBadge({ p }: { p: Product }) {
  const st = stateOf({ state: p.state, remaining: p.remaining, incoming_qty: p.incoming_qty })
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATE_STYLE[st]}`}>
      {sellerLabel(st, p.remaining)}
    </span>
  )
}

// "3 tadan 1 ta sotildi" + a bar filled by sold/had.
// Small batches (≤10) draw one pill per item, so "1 of 3" is literally countable;
// bigger ones fall back to a single bar. Unsold slots keep a dashed outline so an
// empty bar still reads as "0 sotildi — hammasi turibdi", not as a missing element.
function SoldProgress({ had, sold, remaining }: { had: number; sold: number; remaining: number }) {
  if (had <= 0) return null
  const pct   = Math.min(100, Math.round((sold / had) * 100))
  const done  = remaining === 0
  const empty = sold === 0
  const fill  = done ? 'bg-success' : 'bg-gradient-to-r from-rose to-peach'
  const track = 'bg-cream border border-dashed border-rose/30'

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs mb-1.5">
        {empty ? (
          <span className="text-muted">
            <b className="text-ink font-semibold">{had} ta</b> turibdi — hali sotilmadi
          </span>
        ) : (
          <span className="text-muted">
            <b className="text-ink font-semibold">{had} tadan {sold} ta</b> sotildi
          </span>
        )}
        <span className={`font-semibold ${done ? 'text-danger' : remaining <= 2 ? 'text-warning' : 'text-success'}`}>
          {done ? 'Tugadi' : S.remaining(remaining)}
        </span>
      </div>

      {had <= 10 ? (
        <div className="flex gap-1">
          {Array.from({ length: had }, (_, i) => (
            <span key={i}
              className={`h-2 flex-1 rounded-full transition-all duration-500 ${i < sold ? fill : track}`} />
          ))}
        </div>
      ) : (
        <div className={`h-2 w-full rounded-full overflow-hidden ${track}`}>
          <div className={`h-full rounded-full transition-all duration-500 ${fill}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
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

export default function SellerHome({ sellerName, summary, monthly, products: initialProducts, thisMonthProfit, requests, available, totalUnitsSold, totalRevenue }: Props) {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [chartOpen, setChartOpen] = useState(false)

  // Per-product "⋯" (more actions) sheet
  const [moreProduct, setMoreProduct] = useState<Product | null>(null)
  const [moreExpiry, setMoreExpiry] = useState('')
  function openMore(p: Product) { setMoreProduct(p); setMoreExpiry(p.expiry_date ?? '') }

  // First-run welcome (shown once per device)
  const [showWelcome, setShowWelcome] = useState(false)
  useEffect(() => {
    if (localStorage.getItem('camelia_seller_welcome_v1') !== '1') setShowWelcome(true)
  }, [])

  // Offline sale queue — flush any sales saved with no signal, on load and when back online.
  const [pendingCount, setPendingCount] = useState(0)
  const [flushMsg, setFlushMsg] = useState('')
  useEffect(() => {
    const supabase = createBrowser()
    async function sync() {
      if (getPending().length === 0) { setPendingCount(0); return }
      if (navigator.onLine) {
        const sent = await flushPending(supabase)
        setPendingCount(getPending().length)
        if (sent > 0) { setFlushMsg(S.pendingFlushed(sent)); setTimeout(() => setFlushMsg(''), 4000); router.replace(router.asPath) }
      } else {
        setPendingCount(getPending().length)
      }
    }
    sync()
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  function dismissWelcome() {
    localStorage.setItem('camelia_seller_welcome_v1', '1')
    setShowWelcome(false)
  }

  // Correction request ("I actually received a different amount")
  // G2 — local so a new request marks its card instantly, with no page reload.
  const [pendingIds, setPendingIds] = useState<string[]>(
    requests.filter(r => r.status === 'pending').map(r => r.product_id)
  )
  const pendingByProduct = new Set(pendingIds)

  // Request a NEW product she doesn't have yet (self-assignment)
  const availableToRequest = available.filter(a => !pendingByProduct.has(a.id))
  const [newOpen, setNewOpen] = useState(false)
  const [newProductId, setNewProductId] = useState('')
  const [newQty, setNewQty] = useState('')
  const [newReason, setNewReason] = useState('')
  const [newBusy, setNewBusy] = useState(false)
  const [newError, setNewError] = useState('')

  function openNewRequest() {
    setNewOpen(true); setNewProductId(''); setNewQty(''); setNewReason(''); setNewError('')
  }
  async function submitNewRequest() {
    if (!newProductId) { setNewError('Mahsulotni tanlang'); return }
    if (newQty === '' || Number(newQty) <= 0) { setNewError("To'g'ri son kiriting"); return }
    setNewBusy(true); setNewError('')
    const res = await fetch('/api/allocation-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: newProductId, requested_qty: Number(newQty), reason: newReason, type: 'new_product' }),
    })
    const json = await res.json().catch(() => ({}))
    setNewBusy(false)
    if (!res.ok) { setNewError(json.error ?? 'Xatolik'); return }
    setNewOpen(false)
    setPendingIds(ids => [...ids, newProductId])   // G2: instant, no reload
  }
  // "Boshqacha son oldim" sheet — a STOCK correction that the admin approves.
  // Sale editing lives on /seller/sales, the single sale editor (redesign.md §4.3).
  const [fixProduct, setFixProduct] = useState<Product | null>(null)
  const [recvQty, setRecvQty] = useState('')
  const [recvReason, setRecvReason] = useState('')
  const [recvBusy, setRecvBusy] = useState(false)
  const [recvError, setRecvError] = useState('')
  const [recvDone, setRecvDone] = useState(false)

  function openFix(p: Product) {
    setFixProduct(p); setRecvQty(String(p.had)); setRecvReason(''); setRecvError(''); setRecvDone(false)
  }
  async function submitReceived() {
    if (!fixProduct) return
    if (recvQty === '' || Number(recvQty) < 0) { setRecvError("To'g'ri son kiriting"); return }
    setRecvBusy(true); setRecvError('')
    const res = await fetch('/api/allocation-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: fixProduct.product_id, requested_qty: Number(recvQty), reason: recvReason }),
    })
    const json = await res.json().catch(() => ({}))
    setRecvBusy(false)
    if (!res.ok) { setRecvError(json.error ?? 'Xatolik'); return }
    setRecvDone(true)
    // G2: mark the card "so'rov kutilmoqda" immediately, no page reload.
    setPendingIds(ids => [...ids, fixProduct.product_id])
  }

  // G2 — products live in local state so writes show instantly.
  const [products, setProducts] = useState<Product[]>(initialProducts)

  // Expiry set (from the stock sheet)
  const [savingExpiry, setSavingExpiry] = useState(false)
  async function saveExpiry(productId: string, date: string) {
    setSavingExpiry(true)
    await fetch('/api/set-expiry', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, expiry_date: date || null }),
    }).catch(() => {})
    setSavingExpiry(false)
    setProducts(list => list.map(p => p.product_id === productId ? { ...p, expiry_date: date || null } : p))
  }
  const visibleProducts = search.trim()
    ? products.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : products

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


  const chartData = monthly.map(m => ({
    label: uzMonth(m.month),
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
              Bu oy daromadingiz:{' '}
              <span className="font-display font-bold text-white text-base">{formatUZS(thisMonthProfit)}</span>
            </p>
          </div>
          {/* 🔔 = everything waiting on her; ⚙ = settings. Neither takes a tab slot. */}
          <div className="flex items-center gap-0.5">
            <button onClick={() => setHelpOpen(true)} aria-label={S.help} className="text-white/70 hover:text-white p-2 transition">
              <HelpCircle className="w-5 h-5" />
            </button>
            <NotificationBell />
            <Link href="/seller/settings" aria-label={S.settings} className="text-white/70 hover:text-white p-2 transition">
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="px-4 -mt-12 relative z-10 space-y-4">

        {/* Offline sale queue status */}
        {flushMsg && (
          <div className="bg-green-50 text-success text-sm font-semibold rounded-xl px-4 py-2.5 text-center">{flushMsg}</div>
        )}
        {pendingCount > 0 && (
          <div className="bg-orange-50 text-warning text-sm font-semibold rounded-xl px-4 py-2.5 text-center">{S.pendingWaiting(pendingCount)}</div>
        )}

        {/* ── Money strip (redesign.md §4.1) ── The star metric is already in the
            header, so this is a compact secondary summary, not four competing cards.
            Selling is the job of this screen; money lives one tap away in Hisobim. ── */}
        <div className="bg-surface rounded-2xl shadow-card grid grid-cols-4 divide-x divide-gray-100 overflow-hidden">
          {[
            { label: 'Sotilgan',        value: formatUZS(totalRevenue),                                    cls: 'text-ink',     href: '/seller/sales' },
            { label: S.earningsSeller,  value: formatUZS(summary?.your_total_profit ?? 0),                 cls: 'text-success', href: '/seller/balance' },
            { label: S.moneyCollect,    value: formatUZS(Math.max(0, summary?.not_submitted ?? 0)),        cls: (summary?.not_submitted ?? 0) > 0 ? 'text-danger' : 'text-success', href: '/seller/balance' },
            { label: S.moneyHandedOver, value: formatUZS(summary?.submitted ?? 0),                         cls: 'text-ink',     href: '/seller/balance' },
          ].map(t => (
            <Link key={t.label} href={t.href} className="px-2 py-3 text-center active:bg-cream transition">
              <p className="text-[10px] font-semibold text-muted leading-tight mb-1">{t.label}</p>
              <p className={`font-display text-sm font-bold leading-tight ${t.cls}`}>{t.value}</p>
            </Link>
          ))}
        </div>

        {/* ── Monthly chart (collapsed by default — progressive disclosure) ── */}
        {chartData.length > 0 && (
          <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
            <button onClick={() => setChartOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4">
              <span className="flex items-center gap-2 font-display font-bold text-ink text-base">
                <TrendingUp className="w-4 h-4 text-rose" /> Oylik grafik
              </span>
              <ChevronDown className={`w-5 h-5 text-muted transition ${chartOpen ? 'rotate-180' : ''}`} />
            </button>
            {chartOpen && (
            <div className="px-5 pb-5">
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
          </div>
        )}

        {/* ── Product cards ── */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-3 px-1">
            <h2 className="font-display font-bold text-ink text-base">{S.myProducts}</h2>
            {availableToRequest.length > 0 && (
              <button onClick={openNewRequest}
                className="flex items-center gap-1.5 text-xs font-semibold text-rose hover:text-roseDark transition">
                <Plus className="w-4 h-4" /> Yangi mahsulot so'rash
              </button>
            )}
          </div>

          {/* Search */}
          {products.length > 0 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mahsulot qidirish…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface text-ink text-sm shadow-card border-2 border-transparent focus:outline-none focus:border-rose transition" />
            </div>
          )}

          {products.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card p-10 text-center text-muted">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{S.noProducts}</p>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card p-8 text-center text-muted text-sm">"{search}" bo'yicha mahsulot topilmadi</div>
          ) : (
            <div className="space-y-4">
              {visibleProducts.map((p, i) => (
                <div key={p.product_id} className="bg-surface rounded-2xl shadow-card overflow-hidden">

                  {/* Swipeable gallery: cover first, then result photos */}
                  <ImageGallery
                    images={[...(p.image_url ? [p.image_url] : []), ...p.gallery]}
                    name={p.name}
                    colorIndex={i}
                    badge={<StockBadge p={p} />}
                  />

                  {/* Card BODY opens the stock sheet; the BUTTON sells. Two clearly
                      different targets (redesign.md §4.1). */}
                  <button onClick={() => openMore(p)} className="w-full text-left px-4 pt-4 pb-2 active:bg-cream/50 transition">
                    <h3 className="font-display font-semibold text-ink text-base leading-snug">{p.name}</h3>

                    {/* Price */}
                    <div className="flex items-center gap-3 mt-1">
                      {p.discount_price != null ? (
                        <>
                          <span className="text-xs text-muted line-through">{formatUZS(p.retail_price)}</span>
                          <span className="text-sm font-bold text-rose">{formatUZS(p.discount_price)}</span>
                        </>
                      ) : (
                        <span className="text-sm font-bold text-ink">{formatUZS(p.retail_price)}</span>
                      )}
                    </div>

                    {/* Status tags: expiry + pending request. The per-unit pills moved
                        into the stock sheet — ONE stock signal on the card (the badge). */}
                    {(() => {
                      const { status } = expiryInfo(p.expiry_date)
                      const showExp = status === 'expired' || status === 'critical' || status === 'soon'
                      if (!showExp && !pendingByProduct.has(p.product_id)) return null
                      return (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {showExp && (
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${status === 'expired' ? 'bg-red-100 text-danger' : status === 'critical' ? 'bg-orange-100 text-warning' : 'bg-yellow-100 text-yellow-700'}`}>
                              <CalendarClock className="w-3 h-3" /> {EXPIRY_LABEL[status]}
                            </span>
                          )}
                          {pendingByProduct.has(p.product_id) && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning bg-orange-50 px-2.5 py-1 rounded-full">
                              <ClipboardList className="w-3 h-3" /> so'rov kutilmoqda
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </button>

                  <div className="px-4 pb-4">
                    {/* Primary action — one big Sotildi */}
                    {p.remaining > 0 ? (
                      <Link href={`/seller/sell?product=${p.product_id}`}
                        className="block w-full bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-3.5 rounded-full text-base text-center shadow-rose active:scale-95 transition">
                        {S.soldBtn}
                      </Link>
                    ) : (
                      <div className="w-full bg-cream text-muted font-display font-bold py-3.5 rounded-full text-base text-center">Tugadi</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <SellerNav />

      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* ── Per-product "⋯" more-actions sheet ── */}
      {moreProduct && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreProduct(null)} />
          <div className="relative bg-surface rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-3">
              <p className="font-display font-bold text-ink text-base truncate">{moreProduct.name}</p>
              <button aria-label="Yopish" onClick={() => setMoreProduct(null)} className="text-muted"><X className="w-5 h-5" /></button>
            </div>
            {/* Where this product stands — the per-unit detail that used to crowd the
                card now lives here, where there is room for it. */}
            <div className="bg-cream rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted">Sizda <b className="text-ink">{moreProduct.remaining} ta</b></span>
                <span className="text-muted"><b className="text-ink">{moreProduct.sold} ta</b> sotildi</span>
              </div>
              <SoldProgress had={moreProduct.had} sold={moreProduct.sold} remaining={moreProduct.remaining} />
            </div>

            <div className="space-y-1">
              {/* The only survivor of the old Tuzatish modal's approval-gated half —
                  reframed as a STOCK action, not a sale edit. Sale edits live on
                  Sotuvlarim, the single sale editor. */}
              <button onClick={() => { const p = moreProduct; setMoreProduct(null); openFix(p) }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-cream transition text-left">
                <span className="w-9 h-9 rounded-full bg-rose/10 grid place-items-center flex-shrink-0"><Pencil className="w-4 h-4 text-rose" /></span>
                <span>
                  <span className="block font-semibold text-sm text-ink">Boshqacha son oldim</span>
                  <span className="block text-xs text-muted">Admin tasdiqlaydi</span>
                </span>
              </button>
              {moreProduct.image_url && (
                <button onClick={() => { const p = moreProduct; setMoreProduct(null); openPost(p) }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-cream transition text-left">
                  <span className="w-9 h-9 rounded-full bg-sky/15 grid place-items-center flex-shrink-0"><Send className="w-4 h-4 text-sky" /></span>
                  <span className="font-semibold text-sm text-ink">Telegram kanalga yuborish</span>
                </button>
              )}
              {moreProduct.link && (
                <a href={moreProduct.link} target="_blank" rel="noopener noreferrer" onClick={() => setMoreProduct(null)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-cream transition">
                  <span className="w-9 h-9 rounded-full bg-red-50 grid place-items-center flex-shrink-0"><PlayCircle className="w-4 h-4 text-red-600" /></span>
                  <span className="font-semibold text-sm text-ink">Videoni ko'rish</span>
                </a>
              )}
              {moreProduct.remaining > 0 && (
                <Link href="/seller/transfers" onClick={() => setMoreProduct(null)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-cream transition text-left">
                  <span className="w-9 h-9 rounded-full bg-mint/20 grid place-items-center flex-shrink-0"><RotateCcw className="w-4 h-4 text-success" /></span>
                  <span className="font-semibold text-sm text-ink">Boshqa sotuvchiga qaytarish</span>
                </Link>
              )}
            </div>

            {/* Expiry editor */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-muted mb-2 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Yaroqlilik muddati</p>
              <div className="flex items-center gap-2">
                <input type="date" value={moreExpiry} onChange={e => setMoreExpiry(e.target.value)}
                  className="flex-1 bg-cream text-ink rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                <button disabled={savingExpiry}
                  onClick={async () => { const p = moreProduct; await saveExpiry(p.product_id, moreExpiry); setMoreProduct(null) }}
                  className="text-sm font-semibold bg-rose text-white px-4 py-2.5 rounded-lg disabled:opacity-50">Saqlash</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── First-run welcome ── */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50" onClick={dismissWelcome} />
          <div className="relative bg-surface rounded-3xl shadow-card p-7 max-w-xs w-full text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose to-peach grid place-items-center mx-auto mb-5">
              <HandHeart className="w-9 h-9 text-white" />
            </div>
            <p className="font-display font-bold text-ink text-lg mb-2">{S.welcomeTitle}</p>
            <p className="text-sm text-muted leading-relaxed mb-4">{S.welcomeBody}</p>
            <div className="bg-orange-50 rounded-xl px-4 py-3 mb-5">
              <p className="text-xs text-yellow-800 leading-relaxed">{S.welcomeReassure}</p>
            </div>
            <button onClick={dismissWelcome}
              className="w-full bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-3.5 rounded-full shadow-rose active:scale-95 transition">
              {S.welcomeStart}
            </button>
          </div>
        </div>
      )}

      {/* ── Telegram post sheet ── */}
      {postProduct && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPostProduct(null)} />
          <div className="relative bg-surface rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-bold text-ink text-base">📢 Kanalga yuborish</p>
              <button aria-label="Yopish" onClick={() => setPostProduct(null)} className="text-muted hover:text-ink transition">
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
                {posting ? 'Yuborilmoqda…' : "Telegram kanalga jo'natish"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Tuzatish (fix received + sold) modal ── */}
      {fixProduct && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFixProduct(null)} />
          <div className="relative bg-surface rounded-t-3xl sm:rounded-3xl p-5 pb-8 w-full sm:max-w-md max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <p className="font-display font-bold text-ink text-base">Boshqacha son oldim</p>
              <button aria-label="Yopish" onClick={() => setFixProduct(null)} className="text-muted hover:text-ink transition"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-muted mb-4 truncate">{fixProduct.name}</p>

            {/* Current summary */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              <div className="bg-cream rounded-xl p-3 text-center">
                <p className="text-xs text-muted mb-0.5">Berilgan</p>
                <p className="font-display font-bold text-lg text-ink">{fixProduct.had}</p>
              </div>
              <div className="bg-cream rounded-xl p-3 text-center">
                <p className="text-xs text-muted mb-0.5">Sotilgan</p>
                <p className="font-display font-bold text-lg text-success">{fixProduct.sold}</p>
              </div>
            </div>

            {/* Received-quantity correction — the one thing here that needs approval */}
            <div className="mb-5">
              <p className="text-sm font-semibold text-ink mb-1">Sizga berilgan soni</p>
              <p className="text-xs text-muted mb-2">Aslida nechta olganingizni yozing. Buni <b>admin tasdiqlaydi</b>.</p>
              {pendingByProduct.has(fixProduct.product_id) ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-warning bg-orange-50 px-3 py-2.5 rounded-xl">
                  <ClipboardList className="w-4 h-4" /> So'rov yuborilgan — admin javobini kuting
                </div>
              ) : recvDone ? (
                <div className="text-center py-2.5 rounded-xl bg-green-50 text-success font-semibold text-sm">✅ So'rov yuborildi</div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={recvQty} onChange={e => setRecvQty(e.target.value)}
                      className="w-20 bg-cream text-ink text-right rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                    <input value={recvReason} onChange={e => setRecvReason(e.target.value)} placeholder="Sabab (ixtiyoriy)…"
                      className="flex-1 bg-cream text-ink rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
                  </div>
                  {recvError && <p className="text-danger text-xs">{recvError}</p>}
                  <button disabled={recvBusy} onClick={submitReceived}
                    className="w-full bg-gradient-to-br from-rose to-peach text-white text-sm font-semibold py-2.5 rounded-full disabled:opacity-50 active:scale-95 transition">
                    {recvBusy ? 'Yuborilmoqda…' : "Admin'ga so'rov yuborish"}
                  </button>
                </div>
              )}
            </div>

            {/* Sale edits are NOT here any more — Sotuvlarim is the single sale
                editor (redesign.md §4.3). This sheet is stock only. */}
            <Link href="/seller/sales" onClick={() => setFixProduct(null)}
              className="flex items-center gap-3 px-3 py-3 rounded-xl bg-cream hover:bg-cream/70 transition">
              <span className="w-9 h-9 rounded-full bg-rose/10 grid place-items-center flex-shrink-0"><Receipt className="w-4 h-4 text-rose" /></span>
              <span>
                <span className="block font-semibold text-sm text-ink">Sotuvni tuzatish kerakmi?</span>
                <span className="block text-xs text-muted">«Sotuvlarim» sahifasida tuzating</span>
              </span>
            </Link>
          </div>
        </div>
      )}

      {/* ── Request a new product sheet ── */}
      {newOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setNewOpen(false)} />
          <div className="relative bg-surface rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-bold text-ink text-base">🆕 Yangi mahsulot so'rash</p>
              <button aria-label="Yopish" onClick={() => setNewOpen(false)} className="text-muted hover:text-ink transition"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-muted mb-4">Sizda yo'q mahsulotni tanlang va nechta olishni yozing. Admin tasdiqlaganda sizga biriktiriladi.</p>

            <label className="block text-xs font-semibold text-muted mb-1">Mahsulot</label>
            <select value={newProductId} onChange={e => setNewProductId(e.target.value)}
              className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent">
              <option value="">Tanlang…</option>
              {availableToRequest.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>

            <label className="block text-xs font-semibold text-muted mb-1">Nechta?</label>
            <input type="number" min={1} value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="0"
              className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />

            <input value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Izoh (ixtiyoriy)…"
              className="w-full bg-cream text-ink rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />

            {newError && <p className="text-danger text-xs mb-2">{newError}</p>}

            <button onClick={submitNewRequest} disabled={newBusy}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-4 rounded-full active:scale-95 transition disabled:opacity-50 shadow-rose">
              {newBusy ? 'Yuborilmoqda…' : "So'rov yuborish"}
            </button>
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
  const [summaryRes, monthlyRes, invRes, catalogRes, requestsRes, availableRes] = await Promise.all([
    supabase.from('v_my_summary').select('*').maybeSingle(),
    supabase.from('v_my_monthly').select('*'),
    supabase.from('v_my_inventory').select('product_id, product_name, had, sold, remaining'),
    // `state`/`incoming_qty` appear once docs/availability-migration-setup.md is run.
    // Until then this select 400s and the catch below retries without them.
    supabase.from('v_catalog').select('id, retail_price, discount_price, image_url, description, link, gallery, expiry_date, state, incoming_qty'),
    supabase.from('v_my_requests').select('*'),
    supabase.from('v_available_products').select('id, name, retail_price, discount_price'),
  ])

  const inv = invRes.data ?? []

  // Retry without the availability columns if the migration hasn't been run.
  let catalog = catalogRes.data
  if (catalogRes.error) {
    const retry = await supabase.from('v_catalog')
      .select('id, retail_price, discount_price, image_url, description, link, gallery, expiry_date')
    catalog = retry.data
  }
  const catMap = Object.fromEntries((catalog ?? []).map((c: any) => [c.id, c]))

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
      expiry_date:    c.expiry_date ?? null,
      had:            i.had,
      sold:           i.sold,
      remaining:      i.remaining,
      state:          c.state ?? null,
      incoming_qty:   c.incoming_qty ?? null,
    }
  })

  const currentMonth = new Date().toISOString().slice(0, 7)
  const thisMonthProfit = (monthlyRes.data ?? []).find(m => m.month === currentMonth)?.your_profit ?? 0

  // Totals for the home summary cards (all-time)
  const totalUnitsSold = products.reduce((n, p) => n + (p.sold ?? 0), 0)
  const totalRevenue = (monthlyRes.data ?? []).reduce((n: number, m: any) => n + (m.revenue ?? 0), 0)

  return {
    props: {
      sellerName:     profile?.full_name ?? '',
      summary:        summaryRes.data ?? null,
      monthly:        monthlyRes.data ?? [],
      products,
      thisMonthProfit,
      requests:       requestsRes.data ?? [],
      available:      availableRes.data ?? [],
      totalUnitsSold,
      totalRevenue,
    }
  }
}
