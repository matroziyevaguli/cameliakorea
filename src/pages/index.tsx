import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createPublicClient, createServiceClient } from '@/lib/supabase/api'
import { formatUZS } from '@/lib/format'
import { stateOf, isBuyable, STATE_LABEL, STATE_STYLE } from '@/lib/availability'
import { Send, AtSign, Sparkles, ArrowRight, ShieldCheck, Truck, MessageCircle, Search, User, ShoppingBag, X, Clock, Bell, ShieldCheck as Shield } from 'lucide-react'

function LoginMenu() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Portal to <body> so the menu escapes the sticky/backdrop-blur header, which on
  // Android clips absolutely-positioned descendants (menu appeared "not showing up").
  const menuContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xs bg-surface rounded-2xl shadow-card p-3 border border-black/5">
        <div className="flex items-center justify-between px-1 pb-2 mb-1">
          <p className="text-sm font-bold text-ink">Kirish</p>
          <button aria-label="Yopish" onClick={() => setOpen(false)} className="text-muted hover:text-ink transition"><X className="w-5 h-5" /></button>
        </div>
        <Link href="/login?as=admin" onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-cream transition">
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-rose to-peach text-white grid place-items-center"><Shield className="w-4 h-4" /></span>
          <span><span className="block text-sm font-semibold text-ink">Admin sifatida</span><span className="block text-xs text-muted">Boshqaruv paneli</span></span>
        </Link>
        <Link href="/login?as=seller" onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-cream transition">
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-mint to-sky text-white grid place-items-center"><ShoppingBag className="w-4 h-4" /></span>
          <span><span className="block text-sm font-semibold text-ink">Sotuvchi sifatida</span><span className="block text-xs text-muted">Mening mahsulotlarim</span></span>
        </Link>
        <a href="#mahsulotlar" onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-cream transition">
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-lavender to-peach text-white grid place-items-center"><User className="w-4 h-4" /></span>
          <span><span className="block text-sm font-semibold text-ink">Xaridor sifatida</span><span className="block text-xs text-muted">Katalogni ko'rish</span></span>
        </a>
      </div>
    </div>
  )
  const menu = open && mounted
    ? (createPortal(menuContent as any, document.body) as unknown as ReactNode)  // eslint-disable-line @typescript-eslint/no-explicit-any
    : null

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 bg-white text-ink text-sm font-semibold px-4 py-2 rounded-full shadow-card active:scale-95 transition">
        <User className="w-4 h-4 text-rose" /> Kirish
      </button>
      {menu}
    </div>
  )
}

// Only SAFE, public fields — cost/profit never leave the server.
type ShopProduct = {
  id: string
  name: string
  retail_price: number
  discount_price: number | null
  image_url: string | null
  description: string | null
  remaining: number   // units left across all sellers; <= 0 means sold out
  state?: string | null            // from v_product_availability
  restock_coming?: boolean | null  // v_shop exposes a boolean, not a count
  just_arrived?: boolean | null
}

const CARD_COLORS = ['#F4628E', '#B9A7F0', '#6FD8C0', '#7CC4F2', '#FFB088', '#E14B79']
const TELEGRAM = 'https://t.me/cameliakorea'

export default function Store({ products }: { products: ShopProduct[] }) {
  return (
    <>
      <Head>
        <title>Camelia Korea — Koreyadan teri parvarishi katalogi</title>
        <meta name="description" content="Camelia Korea — Koreyadan original teri parvarish mahsulotlari katalogi. Buyurtma uchun Telegram orqali bog'laning. O'zbekiston bo'ylab yetkazib berish." />
        <meta property="og:title" content="Camelia Korea" />
        <meta property="og:description" content="Koreyadan original teri parvarish mahsulotlari katalogi." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Public storefront: open to search engines and AI agents. */}
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href="https://www.cameliakorea.com/" />
      </Head>

      <div className="min-h-screen bg-cream text-ink font-sans">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-cream/85 backdrop-blur border-b border-black/5">
          <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-rose to-peach text-white grid place-items-center text-sm shadow-rose">C</span>
              Camelia <span className="text-rose">Korea</span>
            </Link>
            <div className="flex items-center gap-2">
              <a href={TELEGRAM} target="_blank" rel="noreferrer"
                className="hidden sm:flex items-center gap-1.5 bg-gradient-to-br from-rose to-peach text-white text-sm font-semibold px-4 py-2 rounded-full shadow-rose active:scale-95 transition">
                <Send className="w-4 h-4" /> Telegram
              </a>
              <LoginMenu />
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[28rem] h-[28rem] bg-gradient-to-br from-rose/25 to-peach/25 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-br from-lavender/20 to-sky/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
          <div className="max-w-6xl mx-auto px-5 py-16 md:py-24 relative">
            <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-1.5 shadow-card text-sm font-medium text-rose mb-6">
              <Sparkles className="w-4 h-4" /> 🇰🇷 Koreyadan original mahsulotlar
            </div>
            <h1 className="font-display font-bold text-4xl md:text-6xl leading-[1.05] max-w-3xl">
              Teringiz uchun eng yaxshi <span className="text-rose">Koreya</span> parvarishi
            </h1>
            <p className="text-muted text-lg mt-5 max-w-xl leading-relaxed">
              Sinab ko'rilgan, original K-beauty mahsulotlari katalogi. Yoqqan mahsulotni tanlang —
              buyurtma uchun Telegram yoki telefon orqali bog'laning.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <a href="#mahsulotlar"
                className="flex items-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold px-6 py-3.5 rounded-full shadow-rose active:scale-95 transition">
                Katalogni ko'rish <ArrowRight className="w-5 h-5" />
              </a>
              <a href={TELEGRAM} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 bg-white text-ink font-semibold px-6 py-3.5 rounded-full shadow-card active:scale-95 transition">
                <Send className="w-5 h-5 text-rose" /> Telegram'da yozish
              </a>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-x-6 gap-y-3 mt-10 text-sm text-muted">
              <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-success" /> Original & sinovdan o'tgan</span>
              <span className="flex items-center gap-2"><Truck className="w-4 h-4 text-sky" /> O'zbekiston bo'ylab yetkazib berish</span>
              <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-rose" /> Maslahat va yordam</span>
            </div>
          </div>
        </section>

        {/* How to order — because we don't sell online */}
        <section className="max-w-6xl mx-auto px-5 pb-4">
          <div className="bg-surface rounded-3xl shadow-card p-6 md:p-8 grid gap-6 md:grid-cols-3">
            {[
              { n: '1', t: 'Tanlang', d: 'Katalogdan yoqqan mahsulotni toping.' },
              { n: '2', t: 'Yozing', d: 'Telegram yoki telefon orqali bog\'laning.' },
              { n: '3', t: 'Qabul qiling', d: 'Mahsulotni qulay tarzda yetkazib beramiz.' },
            ].map(s => (
              <div key={s.n} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose to-peach text-white grid place-items-center font-display font-bold flex-shrink-0">{s.n}</div>
                <div>
                  <p className="font-display font-bold">{s.t}</p>
                  <p className="text-sm text-muted mt-0.5">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Products */}
        <section id="mahsulotlar" className="max-w-6xl mx-auto px-5 py-12">
          <div className="flex items-end justify-between mb-8 gap-4">
            <div>
              <h2 className="font-display font-bold text-2xl md:text-3xl">Katalog</h2>
              <p className="text-muted text-sm mt-1">Buyurtma uchun mahsulotni bosing.</p>
            </div>
            {products.length > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-sm text-muted bg-white px-3 py-1.5 rounded-full shadow-card">
                <Search className="w-4 h-4" /> {products.length} ta mahsulot
              </span>
            )}
          </div>

          {products.length === 0 ? (
            <div className="bg-surface rounded-2xl shadow-card p-16 text-center">
              <p className="text-muted">Katalog tez orada to'ldiriladi. Yangiliklar uchun Telegram'ga obuna bo'ling.</p>
              <a href={TELEGRAM} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 mt-4 bg-gradient-to-br from-rose to-peach text-white font-semibold px-5 py-2.5 rounded-full shadow-rose">
                <Send className="w-4 h-4" /> Telegram
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map((p, i) => {
                // ONE stock signal, from the shared vocabulary (redesign.md §1.1).
                const st = stateOf(p)
                const soldOut = !isBuyable(st)
                return (
                  <Link key={p.id} href={`/product/${p.id}`}
                    className="group bg-surface rounded-2xl shadow-card overflow-hidden hover:shadow-rose hover:-translate-y-0.5 transition">
                    <div className="relative aspect-square overflow-hidden">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} loading="lazy"
                          className={`w-full h-full object-cover transition duration-500 ${soldOut ? 'grayscale opacity-70' : 'group-hover:scale-105'}`} />
                      ) : (
                        <div className={`w-full h-full grid place-items-center ${soldOut ? 'grayscale opacity-70' : ''}`}
                          style={{ background: `linear-gradient(135deg, ${CARD_COLORS[i % CARD_COLORS.length]}30, ${CARD_COLORS[(i + 1) % CARD_COLORS.length]}55)` }}>
                          <span className="font-display font-bold text-6xl opacity-60"
                            style={{ color: CARD_COLORS[i % CARD_COLORS.length] }}>{p.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}

                      {/* The single state badge — "Tugadi" and "Tugadi — yo'lda" are
                          now visibly different, which was the whole point. */}
                      <span className={`absolute top-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full ${STATE_STYLE[st]}`}>
                        {STATE_LABEL[st]}
                      </span>
                      {p.discount_price != null && !soldOut && (
                        <span className="absolute top-3 left-3 bg-rose text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-rose">Chegirma</span>
                      )}
                      {p.just_arrived && !soldOut && (
                        <span className="absolute bottom-3 left-3 bg-success text-white text-xs font-bold px-2.5 py-1 rounded-full">Keldi ✅</span>
                      )}
                      {soldOut && (
                        <span className="absolute inset-x-0 bottom-0 bg-ink/80 text-white text-center text-xs font-semibold py-1.5">
                          {st === 'sold_out_incoming' || st === 'not_arrived'
                            ? "Tez orada — kanalga obuna bo'ling"
                            : 'Hozircha mavjud emas'}
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-display font-semibold text-sm md:text-base leading-snug line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
                      <div className="mt-2 flex items-baseline gap-2">
                        {p.discount_price != null ? (
                          <>
                            <span className={`font-display font-bold ${soldOut ? 'text-muted' : 'text-rose'}`}>{formatUZS(p.discount_price)}</span>
                            <span className="text-xs text-muted line-through">{formatUZS(p.retail_price)}</span>
                          </>
                        ) : (
                          <span className={`font-display font-bold ${soldOut ? 'text-muted' : 'text-ink'}`}>{formatUZS(p.retail_price)}</span>
                        )}
                      </div>
                      <span className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold transition-all ${soldOut ? 'text-muted' : 'text-rose group-hover:gap-2'}`}>
                        Batafsil <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* Order CTA band */}
        <section className="max-w-6xl mx-auto px-5 pb-12">
          <div className="rounded-3xl bg-gradient-to-br from-rose to-peach text-white p-8 md:p-12 text-center shadow-rose relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3" />
            <h2 className="font-display font-bold text-2xl md:text-3xl relative">Savolingiz bormi?</h2>
            <p className="text-white/90 mt-2 relative">Maslahat va buyurtma uchun biz bilan bog'laning.</p>
            <a href={TELEGRAM} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 mt-6 bg-white text-rose font-display font-bold px-6 py-3.5 rounded-full active:scale-95 transition relative">
              <Send className="w-5 h-5" /> Telegram orqali yozish
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-ink text-white/80">
          <div className="max-w-6xl mx-auto px-5 py-12 grid gap-8 md:grid-cols-3">
            <div>
              <p className="font-display font-bold text-white text-lg mb-2">Camelia Korea</p>
              <p className="text-sm leading-relaxed">Koreyadan original teri parvarish mahsulotlari katalogi. Sifat kafolati bilan.</p>
            </div>
            <div>
              <p className="font-semibold text-white mb-3">Buyurtma uchun</p>
              <div className="space-y-1.5 text-sm">
                <p>🏙 Namangan: Gulshanoy +998 94 099 44 99</p>
                <p>🏙 Andijon: Saida +998 93 858 27 27</p>
                <p>🏙 Farg'ona: Adolat +998 33 408 61 83</p>
              </div>
            </div>
            <div>
              <p className="font-semibold text-white mb-3">Ijtimoiy tarmoqlar</p>
              <div className="flex gap-3">
                <a href={TELEGRAM} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/10 grid place-items-center hover:bg-white/20 transition"><Send className="w-5 h-5" /></a>
                <a href="https://instagram.com/cameliakorea" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/10 grid place-items-center hover:bg-white/20 transition"><AtSign className="w-5 h-5" /></a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 py-5 text-center text-xs text-white/50">
            © 2026 Camelia Korea · <Link href="/login" className="hover:text-white/80">Kirish</Link>
          </div>
        </footer>
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async () => {
  // Preferred: public `v_shop` view via the anon key. v_shop now exposes `remaining`.
  let data: any[] | null = null
  try {
    const pub = createPublicClient()
    // Ask for the availability columns first; if the migration hasn't been run yet
    // PostgREST 400s on the unknown columns, so fall back to the base shape. Either
    // way stateOf() produces a badge — see src/lib/availability.ts.
    const BASE = 'id, name, retail_price, discount_price, image_url, description, remaining'
    // v_shop exposes `restock_coming` (boolean) — NOT `incoming_qty`. Asking for the
    // wrong name 400s and silently drops us to the fallback, losing `state` entirely.
    let res: any = await pub.from('v_shop').select(`${BASE}, state, restock_coming, just_arrived`).order('name')
    if (res.error) res = await pub.from('v_shop').select(BASE).order('name')
    if (!res.error && res.data) data = res.data
  } catch { /* fall through */ }

  // Fallback: service-role read of products + sales to compute remaining stock.
  // (Works locally / before the updated v_shop is created.) Cost never selected.
  if (!data || data.length === 0) {
    try {
      const svc = createServiceClient()
      const [{ data: prods }, { data: sales }] = await Promise.all([
        svc.from('products').select('id, name, retail_price, discount_price, image_url, description, total_qty').order('name'),
        svc.from('sales').select('product_id, qty'),
      ])
      const soldBy: Record<string, number> = {}
      for (const s of sales ?? []) soldBy[s.product_id] = (soldBy[s.product_id] ?? 0) + s.qty
      data = (prods ?? []).map((p: any) => ({
        ...p,
        remaining: Math.max(0, (p.total_qty ?? 0) - (soldBy[p.id] ?? 0)),
      }))
    } catch { /* leave empty */ }
  }

  const products: ShopProduct[] = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    retail_price: p.retail_price,
    discount_price: p.discount_price,
    image_url: p.image_url,
    description: p.description,
    remaining: typeof p.remaining === 'number' ? p.remaining : 0,
    state: p.state ?? null,
    restock_coming: p.restock_coming ?? null,
    just_arrived: p.just_arrived ?? null,
  }))

  // Buyable first; "coming back" ahead of plain sold-out, so a customer sees hope
  // before dead ends. Discontinued never reach here (v_shop filters them).
  const rank = (p: ShopProduct) => {
    const s = stateOf(p)
    return isBuyable(s) ? 0 : s === 'sold_out_incoming' || s === 'not_arrived' ? 1 : 2
  }
  products.sort((a, b) => rank(a) - rank(b))

  return { props: { products } }
}
