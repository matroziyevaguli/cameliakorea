import { cardDigits, formatCardNumber, detectBrand, isValidCard } from '@/lib/card'
import { Check, AlertCircle } from 'lucide-react'

// One input, auto-formats to "4 4 4 4", detects Uzcard/Humo, and validates 16 digits inline.
// Emits DIGITS ONLY via onChange so the parent stores a normalized value.
export default function CardNumberInput({ value, onChange }: { value: string; onChange: (digits: string) => void }) {
  const digits = cardDigits(value)
  const brand = detectBrand(digits)
  const valid = isValidCard(digits)
  const showError = digits.length > 0 && !valid

  return (
    <div>
      <div className="relative">
        <input
          value={formatCardNumber(digits)}
          onChange={e => onChange(cardDigits(e.target.value))}
          inputMode="numeric" autoComplete="cc-number" placeholder="8600 0000 0000 0000"
          className={`w-full bg-cream text-ink rounded-xl pl-4 pr-24 py-3 text-base tracking-wider font-mono focus:outline-none focus:ring-2 border-2 transition ${showError ? 'border-danger/40 focus:ring-danger' : 'border-transparent focus:ring-rose'}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {brand && <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${brand.cls}`}>{brand.label}</span>}
          {valid && <Check className="w-4 h-4 text-success" />}
        </div>
      </div>
      {showError && (
        <p className="flex items-center gap-1 text-xs text-danger mt-1">
          <AlertCircle className="w-3.5 h-3.5" /> Karta 16 ta raqamdan iborat bo'lishi kerak ({digits.length}/16)
        </p>
      )}
    </div>
  )
}
