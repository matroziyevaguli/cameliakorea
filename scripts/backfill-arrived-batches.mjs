// One-time, idempotent backfill: give every product an `arrived` partiya that matches the
// stock it really has, so `remaining = arrived − sold` equals what the site shows today.
//
//   node scripts/backfill-arrived-batches.mjs            # dry-run (prints, writes nothing)
//   node scripts/backfill-arrived-batches.mjs --commit   # actually insert
//   node scripts/backfill-arrived-batches.mjs --revert   # delete rows this script created
//
// Rule: for each product with NO arrived partiya, desired = max(total_qty, sold).
//   - normal no-partiya products         → desired = total_qty
//   - the 2 broken ones (total 0, sold 5)→ desired = 5   (fixes −5; their yo'lda-5 is kept)
//   - genuinely not-arrived (total 0, sold 0) → desired 0 → skipped, stays "Yo'lda"
// Idempotent: a product that already has an arrived partiya is skipped. The inserted rows are
// tagged lot_label='backfill' / note='auto-reconcile' so --revert can remove exactly them.
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const COMMIT = process.argv.includes('--commit')
const REVERT = process.argv.includes('--revert')
const TAG = { lot_label: 'backfill', note: 'auto-reconcile' }

async function api(path, init = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const t = await r.text()
  let j; try { j = JSON.parse(t) } catch { j = t }
  if (r.status >= 400) throw new Error(`HTTP ${r.status} ${path}: ${JSON.stringify(j)}`)
  return j
}

if (REVERT) {
  const gone = await api(`product_batches?lot_label=eq.backfill&note=eq.auto-reconcile`, {
    method: 'DELETE', headers: { Prefer: 'return=representation' },
  })
  console.log(`Reverted: deleted ${gone.length} backfill partiya(lar).`)
  process.exit(0)
}

const prods   = await api('products?select=id,name,total_qty&limit=1000')
const batches = await api('product_batches?select=product_id,quantity,status&limit=5000')
const sales   = await api('sales?select=product_id,qty&limit=100000')
const soldOf = id => sales.filter(s => s.product_id === id).reduce((n, s) => n + (s.qty || 0), 0)
const hasArrived = id => batches.some(b => b.product_id === id && b.status === 'arrived')

const plan = []
for (const p of prods) {
  if (hasArrived(p.id)) continue            // already reconciled — idempotent skip
  const sold = soldOf(p.id)
  const desired = Math.max(p.total_qty || 0, sold)
  if (desired <= 0) continue                // genuinely not-arrived — leave as "Yo'lda"
  plan.push({ id: p.id, name: p.name, total_qty: p.total_qty, sold, desired })
}

console.log(`${COMMIT ? 'COMMIT' : 'DRY-RUN'} — ${plan.length} product(s) will get an arrived partiya:\n`)
for (const x of plan) {
  console.log(`  ${x.name.slice(0, 40).padEnd(40)} total=${x.total_qty} sold=${x.sold} → arrived partiya ${x.desired}`)
}
if (!plan.length) { console.log('Nothing to do.'); process.exit(0) }

if (!COMMIT) { console.log('\n(dry-run — pass --commit to write)'); process.exit(0) }

let ok = 0
for (const x of plan) {
  await api('product_batches', {
    method: 'POST',
    body: JSON.stringify({ product_id: x.id, quantity: x.desired, status: 'arrived', ...TAG }),
  })
  ok++
}
console.log(`\nInserted ${ok} arrived partiya(lar).`)
