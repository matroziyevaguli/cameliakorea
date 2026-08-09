// Uzbek payment-card helpers (Uzcard / Humo). Cards are 16 digits; we store DIGITS ONLY and
// format on display. Brand is detected from the BIN prefix so a customer/seller can tell which
// card is which at a glance.

export type CardBrand = { key: 'uzcard' | 'humo'; label: string; cls: string }

/** Strip to digits, max 16. */
export function cardDigits(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '').slice(0, 16)
}

/** "8600123456789012" → "8600 1234 5678 9012" (works on partial input too). */
export function formatCardNumber(s: string | null | undefined): string {
  return cardDigits(s).replace(/(.{4})/g, '$1 ').trim()
}

/** Uzcard starts 8600, Humo starts 9860. Unknown ⇒ null (still allowed). */
export function detectBrand(s: string | null | undefined): CardBrand | null {
  const d = cardDigits(s)
  if (d.startsWith('8600')) return { key: 'uzcard', label: 'Uzcard', cls: 'bg-sky/20 text-sky' }
  if (d.startsWith('9860')) return { key: 'humo',   label: 'Humo',   cls: 'bg-mint/25 text-success' }
  return null
}

/** A card is “complete” at 16 digits. */
export function isValidCard(s: string | null | undefined): boolean {
  return cardDigits(s).length === 16
}

/** "•••• 9012" for compact display. */
export function maskCard(s: string | null | undefined): string {
  const d = cardDigits(s)
  return d.length >= 4 ? `•••• ${d.slice(-4)}` : formatCardNumber(d)
}
