export function formatDate(dateStr: string, withTime = false): string {
  const d = new Date(dateStr)
  const dd   = String(d.getDate()).padStart(2, '0')
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  if (!withTime) return `${dd}/${mm}/${yyyy}`
  const hh   = String(d.getHours()).padStart(2, '0')
  const min  = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export function formatUZS(amount: number | null | undefined): string {
  if (amount == null) return "0 so'm"
  // Use a fixed locale so server and client produce identical output (no hydration mismatch)
  return `${Math.round(amount).toLocaleString('en-US').replace(/,/g, ' ')} so'm`
}
