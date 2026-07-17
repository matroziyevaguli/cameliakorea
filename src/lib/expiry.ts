export type ExpiryStatus = 'expired' | 'critical' | 'soon' | 'ok' | 'none'

// Days until expiry (negative = past) and a tier. Compute once on the server to avoid
// hydration mismatches. Tiers: expired <0, critical ≤30d, soon ≤90d, ok >90d.
export function expiryInfo(dateStr: string | null | undefined): { status: ExpiryStatus; days: number | null } {
  if (!dateStr) return { status: 'none', days: null }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0)
  if (isNaN(exp.getTime())) return { status: 'none', days: null }
  const days = Math.round((exp.getTime() - today.getTime()) / 86400000)
  if (days < 0) return { status: 'expired', days }
  if (days <= 30) return { status: 'critical', days }
  if (days <= 90) return { status: 'soon', days }
  return { status: 'ok', days }
}

// Uzbek label for a tier.
export const EXPIRY_LABEL: Record<ExpiryStatus, string> = {
  expired: 'Muddati tugagan',
  critical: 'Tez tugaydi',
  soon: 'Yaqinlashmoqda',
  ok: 'Yaxshi',
  none: '—',
}
