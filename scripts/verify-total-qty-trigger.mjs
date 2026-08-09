// Behavioural check that trg_sync_total_qty is installed: add a temporary arrived batch and
// see whether products.total_qty moves on its own, then remove it and confirm it reverts.
// Fully reversible — the probe batch is deleted at the end.
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
async function api(path, init = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  })
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  if (r.status >= 400) throw new Error(`HTTP ${r.status} ${path}: ${JSON.stringify(j)}`)
  return j
}
const qtyOf = async id => (await api(`products?id=eq.${id}&select=total_qty`))[0].total_qty

const prod = (await api('products?select=id,name,total_qty&order=name&limit=1'))[0]
const before = prod.total_qty
console.log(`Probe product: ${prod.name}  (total_qty=${before})`)

const [batch] = await api('product_batches', {
  method: 'POST',
  body: JSON.stringify({ product_id: prod.id, quantity: 1, status: 'arrived', lot_label: 'trigger-test', note: 'trigger-test' }),
})
const afterAdd = await qtyOf(prod.id)
console.log(`+1 arrived batch → total_qty=${afterAdd}  ${afterAdd === before + 1 ? '✅ auto-updated' : '❌ NOT updated'}`)

await api(`product_batches?id=eq.${batch.id}`, { method: 'DELETE' })
const afterDel = await qtyOf(prod.id)
console.log(`deleted probe batch → total_qty=${afterDel}  ${afterDel === before ? '✅ reverted' : '❌ did not revert'}`)

const ok = afterAdd === before + 1 && afterDel === before
console.log(`\n${ok ? 'TRIGGER IS LIVE ✅' : 'TRIGGER NOT INSTALLED ❌ — run docs/total-qty-from-batches-setup.md'}`)
process.exit(ok ? 0 : 1)
