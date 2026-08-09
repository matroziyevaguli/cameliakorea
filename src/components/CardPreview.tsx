import { formatCardNumber, detectBrand } from '@/lib/card'

// A small card-shaped preview so it's obvious "which card is which" — brand, number, holder.
// Used live in seller settings and on the customer payment screen.
export default function CardPreview({ number, holder }: { number: string | null; holder: string | null }) {
  const brand = detectBrand(number)
  return (
    <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-ink to-lavender shadow-card">
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs uppercase tracking-widest text-white/60">Karta</span>
        <span className="text-sm font-bold">{brand?.label ?? ''}</span>
      </div>
      <p className="font-mono text-lg tracking-widest">{formatCardNumber(number) || '•••• •••• •••• ••••'}</p>
      <p className="text-sm text-white/80 mt-2 uppercase truncate">{holder || 'KARTA EGASI'}</p>
    </div>
  )
}
