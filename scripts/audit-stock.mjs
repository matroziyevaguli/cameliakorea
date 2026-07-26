// Read-only stock audit. Exposes the drift between the old hand-typed `total_qty`
// and the real shipment math (`arrived − sold`) that the website/seller app use.
//
//   node scripts/audit-stock.mjs
//
// Columns per product:
//   total  = products.total_qty (old hand-typed number)
//   arriv  = Σ arrived partiyalar
//   incom  = Σ in_transit/ordered partiyalar ("yo'lda")
//   sold   = Σ sales.qty
//   oldQ   = total_qty − sold            (the current dashboard "Qoldi", can go negative)
//   realR  = max(0, arrived − sold)      (THE stock number we're moving everything onto)
//   webNow = v_product_availability.remaining (what the live site shows today)
//
// Flags: NO-PARTIYA (no partiya at all), NEG-QOLDI (oldQ<0), web≠realR (drift), discont.
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY

async function q(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
  })
  const t = await r.text()
  let j; try { j = JSON.parse(t) } catch { j = t }
  return { j, range: r.headers.get('content-range') }
}

const prods   = (await q('products?select=id,name,total_qty,discontinued_at&limit=1000')).j
const batches = (await q('product_batches?select=product_id,quantity,status&limit=5000')).j
const salesRes = await q('sales?select=product_id,qty&limit=100000')
const sales   = salesRes.j
const avail   = (await q('v_product_availability?select=product_id,remaining,state&limit=1000')).j
console.error(`rows: products=${prods.length} batches=${batches.length} sales=${sales.length} (range ${salesRes.range})`)

const sum = (arr, f) => arr.reduce((n, x) => n + (f(x) || 0), 0)
const availMap = new Map(avail.map(a => [a.product_id, a]))

const rows = prods.map(p => {
  const b = batches.filter(x => x.product_id === p.id)
  const arrived  = sum(b.filter(x => x.status === 'arrived'), x => x.quantity)
  const incoming = sum(b.filter(x => x.status === 'in_transit' || x.status === 'ordered'), x => x.quantity)
  const sold     = sum(sales.filter(x => x.product_id === p.id), x => x.qty)
  const hasBatch = b.length > 0
  const hasArrived = b.some(x => x.status === 'arrived')
  const web = availMap.get(p.id)
  return {
    name: p.name, total_qty: p.total_qty, arrived, incoming, sold, hasBatch, hasArrived,
    old_qoldi: p.total_qty - sold, real_remaining: Math.max(0, arrived - sold),
    web_now: web ? web.remaining : null, web_state: web ? web.state : null, disc: !!p.discontinued_at,
  }
})
rows.sort((a, b) => a.name.localeCompare(b.name))

const pad  = (s, n) => String(s).padEnd(n)
const padL = (s, n) => String(s).padStart(n)
console.log(pad('PRODUCT', 34) + padL('total', 6) + padL('arriv', 6) + padL('incom', 6) + padL('sold', 6) + padL('oldQ', 6) + padL('realR', 6) + padL('webNow', 7) + '  state / flags')
console.log('-'.repeat(100))
for (const r of rows) {
  const flags = []
  if (!r.hasBatch) flags.push('NO-PARTIYA')
  if (r.old_qoldi < 0) flags.push('NEG-QOLDI')
  if (r.web_now !== r.real_remaining) flags.push('web≠realR')
  if (r.disc) flags.push('discont')
  console.log(pad(r.name.slice(0, 33), 34) + padL(r.total_qty, 6) + padL(r.arrived, 6) + padL(r.incoming, 6) + padL(r.sold, 6) + padL(r.old_qoldi, 6) + padL(r.real_remaining, 6) + padL(r.web_now, 7) + '  ' + (r.web_state || '') + '  ' + flags.join(' '))
}
console.log('-'.repeat(100))
console.log(`TOTALS  products=${rows.length}  no-partiya=${rows.filter(r => !r.hasBatch).length}  neg-qoldi=${rows.filter(r => r.old_qoldi < 0).length}  web≠realR=${rows.filter(r => r.web_now !== r.real_remaining).length}`)
