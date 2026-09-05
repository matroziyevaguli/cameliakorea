import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { createPublicClient, createServiceClient } from '@/lib/supabase/api'
import { formatUZS } from '@/lib/format'
import { stateOf, isBuyable, STATE_STYLE } from '@/lib/availability'
import { useCart } from '@/lib/cart'
import { useT } from '@/i18n'
import LangSwitcher from '@/components/LangSwitcher'
import CartFab from '@/components/CartFab'
import { Send, ChevronLeft, Play, ShoppingBag, Check } from 'lucide-react'

type Product = {
  id: string
  name: string
  retail_price: number
  discount_price: number | null
  description: string | null
  link: string | null
  images: string[]   // cover first, then gallery
  remaining: number  // <= 0 means sold out
  state?: string | null
  restock_coming?: boolean | null
}

const TELEGRAM = 'https://t.me/cameliakorea'

export default function ProductPage({ product }: { product: Product | null }) {
  const t = useT()
  const [active, setActive] = useState(0)
  const { add } = useCart()
  const [added, setAdded] = useState(false)
  const [qty, setQty] = useState(1)

  if (!product) return (
    <div className="min-h-screen bg-cream grid place-items-center text-muted">{t('product.notFound')}</div>
  )

  const orderText = encodeURIComponent(t('product.tgOrder', { name: product.name }))
  const price = product.discount_price ?? product.retail_price
  const st = stateOf(product)
  const soldOut = !isBuyable(st)

  return (
    <>
      <Head>
        <title>{product.name} — Camelia Korea</title>
        {product.description && <meta name="description" content={product.description.slice(0, 160)} />}
        {/* Public storefront: open to search engines and AI agents. */}
        <meta name="robots" content="index, follow, max-image-preview:large" />
      </Head>
      <div className="min-h-screen bg-cream text-ink font-sans">
        <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur border-b border-black/5">
          <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-muted hover:text-rose transition">
              <ChevronLeft className="w-4 h-4" /> {t('nav.backToShop')}
            </Link>
            <div className="flex items-center gap-2">
              <LangSwitcher />
              <Link href="/" className="font-display font-bold">Camelia Korea</Link>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-5 py-8 grid md:grid-cols-2 gap-8">
          {/* Gallery */}
          <div>
            <div className="aspect-square rounded-3xl overflow-hidden bg-surface shadow-card">
              {product.images.length > 0 ? (
                <img src={product.images[active]} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center bg-gradient-to-br from-rose/20 to-peach/30">
                  <span className="font-display font-bold text-7xl text-rose/60">{product.name.charAt(0)}</span>
                </div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
                {product.images.map((src, i) => (
                  <button key={i} onClick={() => setActive(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition ${active === i ? 'border-rose' : 'border-transparent opacity-70'}`}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display font-bold text-2xl md:text-3xl leading-tight">{product.name}</h1>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${STATE_STYLE[st]}`}>{t(`state.${st}`)}</span>
            </div>

            <div className="flex items-baseline gap-3 mt-4">
              <span className={`font-display font-bold text-3xl ${soldOut ? 'text-muted' : 'text-rose'}`}>{formatUZS(price)}</span>
              {product.discount_price != null && (
                <span className="text-muted line-through">{formatUZS(product.retail_price)}</span>
              )}
            </div>

            {st === 'low' && (
              <p className="mt-2 text-sm font-semibold text-warning">{t('product.lowLeft', { n: product.remaining })}</p>
            )}

            {product.description && (
              <p className="text-muted leading-relaxed mt-5 whitespace-pre-line">{product.description}</p>
            )}

            <div className="mt-8 space-y-3">
              {soldOut ? (
                <a href={`${TELEGRAM}?text=${encodeURIComponent(t('product.tgAsk', { name: product.name }))}`} target="_blank" rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-ink text-white font-display font-bold text-lg py-4 rounded-full active:scale-95 transition">
                  <Send className="w-5 h-5" /> {t('product.askAvailable')}
                </a>
              ) : added ? (
                <Link href="/savat"
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-mint to-success text-white font-display font-bold text-lg py-4 rounded-full shadow-card active:scale-95 transition">
                  <Check className="w-5 h-5" /> {t('product.addedGoCart')}
                </Link>
              ) : (
                <div className="flex items-center gap-3">
                  {/* Quantity stepper */}
                  <div className="flex items-center gap-1 bg-cream rounded-full p-1 flex-shrink-0">
                    <button aria-label={t('common.decrease')} onClick={() => setQty(q => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-full bg-surface grid place-items-center text-ink active:scale-90 transition">−</button>
                    <span className="w-8 text-center font-display font-bold text-ink">{qty}</span>
                    <button aria-label={t('common.increase')} onClick={() => setQty(q => Math.min(product.remaining, q + 1))}
                      className="w-10 h-10 rounded-full bg-surface grid place-items-center text-ink active:scale-90 transition">+</button>
                  </div>
                  <button onClick={() => { add({ id: product.id, name: product.name, price, image_url: product.images[0] ?? null }, qty); setAdded(true) }}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold text-lg py-4 rounded-full shadow-rose active:scale-95 transition">
                    <ShoppingBag className="w-5 h-5" /> {t('product.addToCart')}
                  </button>
                </div>
              )}
              {!soldOut && (
                <a href={`${TELEGRAM}?text=${orderText}`} target="_blank" rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-white text-ink font-semibold py-3.5 rounded-full shadow-card active:scale-95 transition">
                  <Send className="w-5 h-5 text-rose" /> {t('product.orderTelegram')}
                </a>
              )}
              {product.link && (
                <a href={product.link} target="_blank" rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-white text-ink font-semibold py-3.5 rounded-full shadow-card active:scale-95 transition">
                  <Play className="w-4 h-4 text-rose" /> {t('product.watchVideo')}
                </a>
              )}
            </div>

            <div className="mt-6 text-sm text-muted space-y-1">
              <p>🇰🇷 {t('product.info1')}</p>
              <p>🚚 {t('home.trust2')}</p>
              {soldOut
                ? <p>⛔ {t('product.infoSoldOut')}</p>
                : <p>⚠️ {t('product.infoLimited')}</p>}
            </div>
          </div>
        </main>
        <CartFab />
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const id = ctx.params?.id as string

  // Preferred: public v_shop view (anon key) — includes gallery + remaining, hides cost.
  try {
    const pub = createPublicClient()
    // Retry without the availability columns when the migration hasn't been run,
    // so we don't fall through to the heavier service-role path unnecessarily.
    const BASE = 'id, name, retail_price, discount_price, image_url, description, link, gallery, remaining'
    let { data: v, error } = await pub.from('v_shop')
      .select(`${BASE}, state, restock_coming`).eq('id', id).single()
    if (error) ({ data: v, error } = await pub.from('v_shop').select(BASE).eq('id', id).single())
    if (!error && v) {
      const gallery: string[] = Array.isArray(v.gallery) ? v.gallery : []
      const product: Product = {
        id: v.id, name: v.name, retail_price: v.retail_price, discount_price: v.discount_price,
        description: v.description, link: v.link,
        images: [...(v.image_url ? [v.image_url] : []), ...gallery],
        remaining: typeof v.remaining === 'number' ? v.remaining : 0,
        state: (v as any).state ?? null,
        restock_coming: (v as any).restock_coming ?? null,
      }
      return { props: { product } }
    }
  } catch { /* fall through */ }

  // Fallback: service-role read + sales to compute remaining (works locally / before v_shop).
  const svc = createServiceClient()
  const [{ data: p }, { data: imgs }, { data: sales }] = await Promise.all([
    svc.from('products').select('id, name, retail_price, discount_price, image_url, description, link, total_qty').eq('id', id).single(),
    svc.from('product_images').select('url, sort_order').eq('product_id', id).order('sort_order', { ascending: true }),
    svc.from('sales').select('qty').eq('product_id', id),
  ])
  if (!p) return { notFound: true }

  const sold = (sales ?? []).reduce((n, s) => n + (s.qty ?? 0), 0)
  const gallery = (imgs ?? []).map(r => r.url)
  const product: Product = {
    id: p.id, name: p.name, retail_price: p.retail_price, discount_price: p.discount_price,
    description: p.description, link: p.link,
    images: [...(p.image_url ? [p.image_url] : []), ...gallery],
    remaining: Math.max(0, (p.total_qty ?? 0) - sold),
  }
  return { props: { product } }
}
