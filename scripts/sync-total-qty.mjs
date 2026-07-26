// After backfill, make the legacy `total_qty` a faithful mirror of arrived stock, so the old
// hand-typed column can't show stale/negative numbers before the read-side switch lands.
// Only touches products where total_qty drifted from arrived (in practice the 2 wiped ones).
//
//   node scripts/sync-total-qty.mjs            # dry-run
//   node scripts/sync-total-qty.mjs --commit   # write
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const COMMIT = process.argv.includes('--commit')

async function api(path, init = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  })
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  if (r.status >= 400) throw new Error(`HTTP ${r.status} ${path}: ${JSON.stringify(j)}`)
  return j
}

const prods   = await api('products?select=id,name,total_qty&limit=1000')
const batches = await api('product_batches?select=product_id,quantity,status&limit=5000')
const arrivedOf = id => batches.filter(b => b.product_id === id && b.status === 'arrived').reduce((n, b) => n + b.quantity, 0)

const plan = prods.map(p => ({ ...p, arrived: arrivedOf(p.id) })).filter(p => p.arrived > 0 && p.total_qty !== p.arrived)
console.log(`${COMMIT ? 'COMMIT' : 'DRY-RUN'} — ${plan.length} product(s) to sync:`)
for (const p of plan) console.log(`  ${p.name.slice(0, 40).padEnd(40)} total_qty ${p.total_qty} -> ${p.arrived}`)
if (!plan.length || !COMMIT) { if (!COMMIT && plan.length) console.log('\n(dry-run — pass --commit)'); process.exit(0) }

for (const p of plan) await api(`products?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify({ total_qty: p.arrived }) })
console.log(`\nSynced ${plan.length} product(s).`)
