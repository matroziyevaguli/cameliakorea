import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { createPublicClient, createServiceClient } from '@/lib/supabase/api'
import { formatUZS } from '@/lib/format'
import { Send, ChevronLeft, Play } from 'lucide-react'

type Product = {
  id: string
  name: string
  retail_price: number
  discount_price: number | null
  description: string | null
  link: string | null
  images: string[]   // cover first, then gallery
  remaining: number  // <= 0 means sold out
}

const TELEGRAM = 'https://t.me/cameliakorea'

export default function ProductPage({ product }: { product: Product | null }) {
  const [active, setActive] = useState(0)

  if (!product) return (
    <div className="min-h-screen bg-cream grid place-items-center text-muted">Mahsulot topilmadi.</div>
  )

  const orderText = encodeURIComponent(`Assalomu alaykum! Men "${product.name}" mahsulotiga buyurtma bermoqchiman.`)
  const price = product.discount_price ?? product.retail_price
  const soldOut = product.remaining <= 0

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
              <ChevronLeft className="w-4 h-4" /> Do'konga qaytish
            </Link>
            <Link href="/" className="font-display font-bold">Camelia Korea</Link>
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
              {soldOut && <span className="bg-ink text-white text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">Tugadi</span>}
            </div>

            <div className="flex items-baseline gap-3 mt-4">
              <span className={`font-display font-bold text-3xl ${soldOut ? 'text-muted' : 'text-rose'}`}>{formatUZS(price)}</span>
              {product.discount_price != null && (
                <span className="text-muted line-through">{formatUZS(product.retail_price)}</span>
              )}
            </div>

            {!soldOut && product.remaining <= 3 && (
              <p className="mt-2 text-sm font-semibold text-warning">⚡ Kam qoldi — atigi {product.remaining} ta</p>
            )}

            {product.description && (
              <p className="text-muted leading-relaxed mt-5 whitespace-pre-line">{product.description}</p>
            )}

            <div className="mt-8 space-y-3">
              {soldOut ? (
                <a href={`${TELEGRAM}?text=${encodeURIComponent(`Assalomu alaykum! "${product.name}" mahsuloti qachon bo'ladi?`)}`} target="_blank" rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-ink text-white font-display font-bold text-lg py-4 rounded-full active:scale-95 transition">
                  <Send className="w-5 h-5" /> Mavjudligini so'rash
                </a>
              ) : (
                <a href={`${TELEGRAM}?text=${orderText}`} target="_blank" rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold text-lg py-4 rounded-full shadow-rose active:scale-95 transition">
                  <Send className="w-5 h-5" /> Telegram orqali buyurtma
                </a>
              )}
              {product.link && (
                <a href={product.link} target="_blank" rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-white text-ink font-semibold py-3.5 rounded-full shadow-card active:scale-95 transition">
                  <Play className="w-4 h-4 text-rose" /> Videoni ko'rish
                </a>
              )}
            </div>

            <div className="mt-6 text-sm text-muted space-y-1">
              <p>🇰🇷 Koreyadan original</p>
              <p>🚚 O'zbekiston bo'ylab yetkazib berish</p>
              {soldOut
                ? <p>⛔ Hozircha tugagan — tez orada qayta keladi</p>
                : <p>⚠️ Mahsulot soni cheklangan</p>}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const id = ctx.params?.id as string

  // Preferred: public v_shop view (anon key) — includes gallery + remaining, hides cost.
  try {
    const pub = createPublicClient()
    const { data: v, error } = await pub
      .from('v_shop')
      .select('id, name, retail_price, discount_price, image_url, description, link, gallery, remaining')
      .eq('id', id)
      .single()
    if (!error && v) {
      const gallery: string[] = Array.isArray(v.gallery) ? v.gallery : []
      const product: Product = {
        id: v.id, name: v.name, retail_price: v.retail_price, discount_price: v.discount_price,
        description: v.description, link: v.link,
        images: [...(v.image_url ? [v.image_url] : []), ...gallery],
        remaining: typeof v.remaining === 'number' ? v.remaining : 0,
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
