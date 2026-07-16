import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/api'
import { formatUZS } from '@/lib/format'
import { Send, AtSign, Sparkles, ArrowRight } from 'lucide-react'

// Only SAFE, public fields — cost/profit never leave the server.
type ShopProduct = {
  id: string
  name: string
  retail_price: number
  discount_price: number | null
  image_url: string | null
  description: string | null
}

const CARD_COLORS = ['#F4628E', '#B9A7F0', '#6FD8C0', '#7CC4F2', '#FFB088', '#E14B79']
const TELEGRAM = 'https://t.me/cameliakorea'

export default function Store({ products }: { products: ShopProduct[] }) {
  return (
    <>
      <Head>
        <title>Camelia Korea — Koreyadan teri parvarishi</title>
        <meta name="description" content="Koreyadan original teri parvarish mahsulotlari. Camelia Korea — sifatli K-beauty mahsulotlari O'zbekistonda." />
        <meta property="og:title" content="Camelia Korea" />
        <meta property="og:description" content="Koreyadan original teri parvarish mahsulotlari." />
      </Head>

      <div className="min-h-screen bg-cream text-ink font-sans">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur border-b border-black/5">
          <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-rose to-peach text-white grid place-items-center text-sm">C</span>
              Camelia Korea
            </Link>
            <a href={TELEGRAM} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 bg-gradient-to-br from-rose to-peach text-white text-sm font-semibold px-4 py-2 rounded-full shadow-rose active:scale-95 transition">
              <Send className="w-4 h-4" /> Telegram
            </a>
          </div>
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-rose/20 to-peach/20 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
          <div className="max-w-6xl mx-auto px-5 py-16 md:py-24 relative">
            <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-1.5 shadow-card text-sm font-medium text-rose mb-6">
              <Sparkles className="w-4 h-4" /> 🇰🇷 Koreyadan original
            </div>
            <h1 className="font-display font-bold text-4xl md:text-6xl leading-tight max-w-2xl">
              Teringiz uchun eng yaxshi <span className="text-rose">Koreya</span> mahsulotlari
            </h1>
            <p className="text-muted text-lg mt-5 max-w-xl leading-relaxed">
              Camelia Korea — sinab ko'rilgan, original K-beauty mahsulotlari.
              O'zbekiston bo'ylab yetkazib beramiz.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <a href="#mahsulotlar"
                className="flex items-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold px-6 py-3.5 rounded-full shadow-rose active:scale-95 transition">
                Mahsulotlarni ko'rish <ArrowRight className="w-5 h-5" />
              </a>
              <a href={TELEGRAM} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 bg-white text-ink font-semibold px-6 py-3.5 rounded-full shadow-card active:scale-95 transition">
                <Send className="w-5 h-5 text-rose" /> Telegram'da buyurtma
              </a>
            </div>
          </div>
        </section>

        {/* Products */}
        <section id="mahsulotlar" className="max-w-6xl mx-auto px-5 py-12">
          <h2 className="font-display font-bold text-2xl md:text-3xl mb-8">Mahsulotlar</h2>

          {products.length === 0 ? (
            <p className="text-muted text-center py-16">Hozircha mahsulot yo'q.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {products.map((p, i) => (
                <Link key={p.id} href={`/product/${p.id}`}
                  className="group bg-surface rounded-2xl shadow-card overflow-hidden hover:shadow-rose transition">
                  <div className="relative aspect-square overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    ) : (
                      <div className="w-full h-full grid place-items-center"
                        style={{ background: `linear-gradient(135deg, ${CARD_COLORS[i % CARD_COLORS.length]}30, ${CARD_COLORS[(i + 1) % CARD_COLORS.length]}55)` }}>
                        <span className="font-display font-bold text-6xl opacity-60"
                          style={{ color: CARD_COLORS[i % CARD_COLORS.length] }}>{p.name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    {p.discount_price != null && (
                      <span className="absolute top-3 left-3 bg-rose text-white text-xs font-bold px-2.5 py-1 rounded-full">Chegirma</span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-display font-semibold text-sm md:text-base leading-snug line-clamp-2 min-h-[2.5rem]">{p.name}</h3>
                    <div className="mt-2 flex items-baseline gap-2">
                      {p.discount_price != null ? (
                        <>
                          <span className="font-display font-bold text-rose">{formatUZS(p.discount_price)}</span>
                          <span className="text-xs text-muted line-through">{formatUZS(p.retail_price)}</span>
                        </>
                      ) : (
                        <span className="font-display font-bold text-ink">{formatUZS(p.retail_price)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="bg-ink text-white/80 mt-8">
          <div className="max-w-6xl mx-auto px-5 py-12 grid gap-8 md:grid-cols-3">
            <div>
              <p className="font-display font-bold text-white text-lg mb-2">Camelia Korea</p>
              <p className="text-sm leading-relaxed">Koreyadan original teri parvarish mahsulotlari. Sifat kafolati bilan.</p>
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
  // Server-side service-role read → strip cost/profit before sending to the browser.
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, retail_price, discount_price, image_url, description')
    .order('name')

  const products: ShopProduct[] = (data ?? []).map(p => ({
    id: p.id,
    name: p.name,
    retail_price: p.retail_price,
    discount_price: p.discount_price,
    image_url: p.image_url,
    description: p.description,
  }))

  return { props: { products } }
}
