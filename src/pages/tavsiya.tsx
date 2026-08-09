import { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { createPublicClient } from '@/lib/supabase/api'
import { formatUZS } from '@/lib/format'
import { stateOf, STATE_LABEL, STATE_STYLE, isBuyable, type ProductState } from '@/lib/availability'
import { SKIN_TYPES, CONCERNS, SKIN_TYPE_LABEL, CONCERN_LABEL, TAG_TYPES, type SkinType } from '@/consts/skincare'
import { Sparkles, ArrowRight, ArrowLeft, Check, RotateCcw } from 'lucide-react'

type SurveyProduct = {
  id: string; name: string; image_url: string | null
  retail_price: number; discount_price: number | null
  remaining: number; state: string | null
  skin_types: string[]; concerns: string[]
}

const MAX_CONCERNS = 3
const RESULTS_LIMIT = 8

export default function Survey({ products }: { products: SurveyProduct[] }) {
  const [step, setStep] = useState<'skin' | 'concerns' | 'results'>('skin')
  const [skinType, setSkinType] = useState<SkinType | ''>('')
  const [concerns, setConcerns] = useState<string[]>([])

  function toggleConcern(v: string) {
    setConcerns(c => c.includes(v) ? c.filter(x => x !== v) : c.length < MAX_CONCERNS ? [...c, v] : c)
  }
  function restart() { setStep('skin'); setSkinType(''); setConcerns([]) }

  // Rank: tier 0 = skin matches AND shares ≥1 concern (by # matched concerns); tier 1 = skin
  // matches only; tier 2 = everything else. In-stock and discounted rise within a tier.
  const ranked = useMemo(() => {
    if (!skinType) return { list: [] as (SurveyProduct & { matched: string[]; tier: number })[], exact: 0 }
    const scored = products.map(p => {
      const skinOk = p.skin_types.includes(skinType)
      const matched = p.concerns.filter(c => concerns.includes(c))
      const tier = skinOk && matched.length > 0 ? 0 : skinOk ? 1 : 2
      return { ...p, matched, tier }
    })
    const st = (p: SurveyProduct) => stateOf({ state: p.state, remaining: p.remaining })
    scored.sort((a, b) =>
      a.tier - b.tier ||
      b.matched.length - a.matched.length ||
      Number(isBuyable(st(b))) - Number(isBuyable(st(a))) ||
      Number(b.discount_price != null) - Number(a.discount_price != null) ||
      b.remaining - a.remaining
    )
    const exact = scored.filter(p => p.tier === 0).length
    return { list: scored.slice(0, RESULTS_LIMIT), exact }
  }, [products, skinType, concerns])

  return (
    <>
      <Head><title>Teri parvarishi tavsiyasi — Camelia Korea</title>
        <meta name="description" content="Bir necha savolga javob bering — teringizga mos Koreya mahsulotlarini tavsiya qilamiz." />
      </Head>
      <div className="min-h-screen bg-cream">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-cream/80 backdrop-blur border-b border-black/5">
          <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-display font-bold text-ink">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-rose to-peach text-white grid place-items-center text-sm shadow-rose">C</span>
              Camelia
            </Link>
            {step !== 'skin' && (
              <button onClick={restart} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition">
                <RotateCcw className="w-4 h-4" /> Qaytadan
              </button>
            )}
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-5 py-8 md:py-12">
          {step !== 'results' ? (
            <>
              {/* Progress */}
              <div className="flex items-center gap-2 mb-8">
                {['skin', 'concerns'].map((s, i) => (
                  <div key={s} className={`h-1.5 flex-1 rounded-full ${(step === 'skin' ? 0 : 1) >= i ? 'bg-rose' : 'bg-black/10'}`} />
                ))}
              </div>

              {step === 'skin' && (
                <section>
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-rose bg-white rounded-full px-3 py-1 shadow-card mb-4">
                    <Sparkles className="w-4 h-4" /> 1-savol
                  </p>
                  <h1 className="font-display font-bold text-3xl md:text-4xl text-ink">Teringiz qanday?</h1>
                  <p className="text-muted mt-2 mb-6">Bittasini tanlang.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {SKIN_TYPES.map(t => (
                      <button key={t.value} onClick={() => { setSkinType(t.value); setStep('concerns') }}
                        className={`rounded-2xl p-5 text-left font-semibold border-2 transition active:scale-95 ${skinType === t.value ? 'bg-rose/10 border-rose text-ink' : 'bg-surface border-transparent shadow-card hover:border-rose/40 text-ink'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {step === 'concerns' && (
                <section>
                  <button onClick={() => setStep('skin')} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition mb-4">
                    <ArrowLeft className="w-4 h-4" /> Orqaga
                  </button>
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-rose bg-white rounded-full px-3 py-1 shadow-card mb-4">
                    <Sparkles className="w-4 h-4" /> 2-savol
                  </p>
                  <h1 className="font-display font-bold text-3xl md:text-4xl text-ink">Nima sizni bezovta qiladi?</h1>
                  <p className="text-muted mt-2 mb-6">{MAX_CONCERNS} tagacha tanlang (ixtiyoriy).</p>
                  <div className="flex flex-wrap gap-2.5">
                    {CONCERNS.map(c => {
                      const on = concerns.includes(c.value)
                      const disabled = !on && concerns.length >= MAX_CONCERNS
                      return (
                        <button key={c.value} onClick={() => toggleConcern(c.value)} disabled={disabled}
                          className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition ${on ? 'bg-mint/20 border-success/40 text-success' : disabled ? 'bg-cream border-transparent text-muted/40' : 'bg-surface border-transparent shadow-card text-ink hover:border-rose/40'}`}>
                          {on && <Check className="w-4 h-4" />} {c.label}
                        </button>
                      )
                    })}
                  </div>
                  <button onClick={() => setStep('results')}
                    className="mt-8 w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold px-8 py-4 rounded-full shadow-rose active:scale-95 transition">
                    Tavsiyani ko'rish <ArrowRight className="w-5 h-5" />
                  </button>
                </section>
              )}
            </>
          ) : (
            <section>
              <button onClick={() => setStep('concerns')} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition mb-4">
                <ArrowLeft className="w-4 h-4" /> Savollarga qaytish
              </button>
              <h1 className="font-display font-bold text-3xl md:text-4xl text-ink">
                {ranked.exact >= 3 ? 'Sizga mos mahsulotlar' : 'Sizga yoqishi mumkin'}
              </h1>
              <p className="text-muted mt-2 mb-2">
                {SKIN_TYPE_LABEL[skinType] ? `${SKIN_TYPE_LABEL[skinType]} teri` : ''}
                {concerns.length > 0 && ` · ${concerns.map(c => CONCERN_LABEL[c]).join(', ')}`}
              </p>
              {ranked.exact < 3 && (
                <p className="text-sm text-muted mb-6 bg-white rounded-xl px-4 py-3 shadow-card">
                  Aniq mos mahsulot kam topildi — quyidagilar ham teringizga yaxshi tanlov.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {ranked.list.map(p => {
                  const st = stateOf({ state: p.state, remaining: p.remaining }) as ProductState
                  const price = p.discount_price ?? p.retail_price
                  return (
                    <Link key={p.id} href={`/product/${p.id}`}
                      className="group bg-surface rounded-2xl shadow-card overflow-hidden hover:shadow-rose transition flex">
                      <div className="w-28 flex-shrink-0 bg-cream">
                        {p.image_url
                          ? <img src={p.image_url} alt={p.name} className={`w-full h-full object-cover ${isBuyable(st) ? '' : 'grayscale opacity-70'}`} />
                          : <div className="w-full h-full grid place-items-center font-display font-bold text-rose">{p.name.charAt(0)}</div>}
                      </div>
                      <div className="p-4 flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-ink text-sm leading-snug line-clamp-2">{p.name}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${STATE_STYLE[st]}`}>{STATE_LABEL[st]}</span>
                        </div>
                        <div className="mt-1.5 flex items-baseline gap-2">
                          <span className="font-display font-bold text-ink">{formatUZS(price)}</span>
                          {p.discount_price != null && <span className="text-xs text-muted line-through">{formatUZS(p.retail_price)}</span>}
                        </div>
                        {p.matched.length > 0 && (
                          <p className="text-[11px] text-success mt-2 leading-snug">✓ {p.matched.map(c => CONCERN_LABEL[c]).join(', ')} uchun</p>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs text-rose font-semibold mt-2 group-hover:gap-1.5 transition-all">
                          Ko'rish <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {ranked.list.length === 0 && (
                <p className="text-muted bg-white rounded-xl px-4 py-6 text-center shadow-card mt-4">
                  Hozircha mos mahsulot topilmadi. <Link href="/#mahsulotlar" className="text-rose font-semibold">Katalogni ko'ring →</Link>
                </p>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={restart} className="flex items-center gap-2 bg-white text-ink font-semibold px-6 py-3 rounded-full shadow-card active:scale-95 transition">
                  <RotateCcw className="w-4 h-4" /> Qaytadan boshlash
                </button>
                <Link href="/#mahsulotlar" className="flex items-center gap-2 text-ink font-semibold px-6 py-3 rounded-full hover:bg-black/5 transition">
                  Butun katalog <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async () => {
  const pub = createPublicClient()
  let products: SurveyProduct[] = []
  try {
    const BASE = 'id, name, retail_price, discount_price, image_url, remaining'
    let res: any = await pub.from('v_shop').select(`${BASE}, state`).order('name')
    if (res.error) res = await pub.from('v_shop').select(BASE).order('name')
    const rows: any[] = res.data ?? []

    const { data: tags } = await pub.from('product_tags').select('product_id, tag_type, tag_value')
    const skinBy = new Map<string, string[]>(), concernBy = new Map<string, string[]>()
    for (const t of tags ?? []) {
      const m = t.tag_type === TAG_TYPES.skinType ? skinBy : t.tag_type === TAG_TYPES.concern ? concernBy : null
      if (!m) continue
      const arr = m.get(t.product_id) ?? []; arr.push(t.tag_value); m.set(t.product_id, arr)
    }
    products = rows.map(p => ({
      id: p.id, name: p.name, image_url: p.image_url ?? null,
      retail_price: p.retail_price, discount_price: p.discount_price ?? null,
      remaining: typeof p.remaining === 'number' ? p.remaining : 0, state: p.state ?? null,
      skin_types: skinBy.get(p.id) ?? [], concerns: concernBy.get(p.id) ?? [],
    }))
  } catch { /* fall through with empty list */ }

  return { props: { products } }
}
