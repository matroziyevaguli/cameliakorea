import { GetServerSideProps } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/guards'
import { useState } from 'react'
import { useRouter } from 'next/router'
import { createClient as createBrowser } from '@/lib/supabase/browser'
import AdminNav from '@/components/AdminNav'
import { formatDate } from '@/lib/format'
import { Gift, Send, AtSign, CheckCircle } from 'lucide-react'

type Product = { id: string; name: string }
type Seller = { id: string; full_name: string }
type Giveaway = {
  id: string; created_at: string; qty: number; winner: string | null
  channel: string | null; note: string | null; product_name: string; seller_name: string | null
}
type Props = { products: Product[]; sellers: Seller[]; giveaways: Giveaway[] }

const CHANNELS = [
  { value: 'telegram',  label: 'Telegram' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'other',     label: 'Boshqa' },
]
const CHANNEL_LABEL: Record<string, string> = { telegram: 'Telegram', instagram: 'Instagram', other: 'Boshqa' }

export default function Giveaways({ products, sellers, giveaways }: Props) {
  const router = useRouter()
  const [productId, setProductId] = useState('')
  const [sellerId, setSellerId] = useState(sellers.find(s => /gulshan/i.test(s.full_name))?.id ?? sellers[0]?.id ?? '')
  const [qty, setQty] = useState('1')
  const [winner, setWinner] = useState('')
  const [channel, setChannel] = useState('telegram')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId || !sellerId || Number(qty) <= 0) { setError('Mahsulot, sotuvchi va sonni tanlang'); return }
    setLoading(true); setError('')
    const supabase = createBrowser()
    const { error: err } = await supabase.from('stock_adjustments').insert({
      seller_id: sellerId, product_id: productId, qty: Number(qty),
      reason: 'giveaway', winner: winner.trim() || null, channel, note: note.trim() || null,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess(true); setWinner(''); setNote(''); setQty('1')
    setTimeout(() => setSuccess(false), 2000)
    router.replace(router.asPath)
  }

  const totalGiven = giveaways.reduce((n, g) => n + g.qty, 0)

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav />
      <main className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="w-6 h-6 text-rose" />
          <h2 className="font-display font-bold text-ink text-2xl">Sovg'alar</h2>
        </div>
        <p className="text-sm text-muted mb-6">
          Telegram/Instagram'da bepul tarqatilgan mahsulotlar. Ombordan chiqadi, lekin pul yoki
          qarz yo'q (bu marketing xarajati).
        </p>

        {/* Record a giveaway */}
        <form onSubmit={submit} className="bg-surface rounded-2xl shadow-card p-5 space-y-4 mb-6">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Mahsulot</label>
              <select value={productId} onChange={e => setProductId(e.target.value)}
                className="w-full bg-cream text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent">
                <option value="">Tanlang…</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Kimning omboridan</label>
              <select value={sellerId} onChange={e => setSellerId(e.target.value)}
                className="w-full bg-cream text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent">
                {sellers.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Soni</label>
              <input type="number" min={1} value={qty} onChange={e => setQty(e.target.value)}
                className="w-full bg-cream text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">Kanal</label>
              <select value={channel} onChange={e => setChannel(e.target.value)}
                className="w-full bg-cream text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent">
                {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">G'olib (ism / @username) — ixtiyoriy</label>
            <input value={winner} onChange={e => setWinner(e.target.value)} placeholder="@username yoki ism"
              className="w-full bg-cream text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">Izoh — ixtiyoriy</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Masalan: Yangi yil aksiyasi"
              className="w-full bg-cream text-ink rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose border-2 border-transparent" />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}
          {success && <p className="flex items-center gap-2 text-success text-sm font-semibold"><CheckCircle className="w-4 h-4" /> Saqlandi!</p>}

          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-rose to-peach text-white font-display font-bold py-3.5 rounded-full shadow-rose active:scale-95 transition disabled:opacity-50">
            <Gift className="w-5 h-5" /> {loading ? 'Saqlanmoqda…' : "Sovg'ani yozib qo'yish"}
          </button>
        </form>

        {/* History */}
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="font-display font-bold text-ink text-lg">Tarix</h3>
          {giveaways.length > 0 && (
            <span className="text-xs font-semibold text-rose bg-rose/10 px-3 py-1.5 rounded-full">
              {giveaways.length} ta sovg'a · {totalGiven} dona
            </span>
          )}
        </div>

        {giveaways.length === 0 ? (
          <div className="bg-surface rounded-2xl shadow-card p-10 text-center text-muted">
            <Gift className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Hali sovg'a yo'q</p>
          </div>
        ) : (
          <div className="space-y-2">
            {giveaways.map(g => (
              <div key={g.id} className="bg-surface rounded-2xl shadow-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink text-sm">{g.product_name} · <span className="text-rose">{g.qty} dona</span></p>
                    <p className="text-xs text-muted mt-0.5">
                      {g.seller_name ? `${g.seller_name} omboridan · ` : ''}{formatDate(g.created_at)}
                    </p>
                    {(g.winner || g.note) && (
                      <p className="text-xs text-muted mt-1">{g.winner ? `🏆 ${g.winner}` : ''}{g.winner && g.note ? ' · ' : ''}{g.note ?? ''}</p>
                    )}
                  </div>
                  {g.channel && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky bg-sky/10 px-2.5 py-1 rounded-full flex-shrink-0">
                      {g.channel === 'instagram' ? <AtSign className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                      {CHANNEL_LABEL[g.channel] ?? g.channel}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const guard = await requireRole(ctx, 'admin')
  if (guard) return guard
  const supabase = createClient(ctx)

  const [{ data: products }, { data: sellers }, { data: giveaways }] = await Promise.all([
    supabase.from('products').select('id, name').order('name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'seller').eq('active', true).order('full_name'),
    supabase.from('v_giveaways').select('*'),
  ])

  return { props: { products: products ?? [], sellers: sellers ?? [], giveaways: giveaways ?? [] } }
}
