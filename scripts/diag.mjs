import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY

async function q(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  return { status: res.status, count: res.headers.get('content-range'), json }
}

const tables = [
  'profiles', 'products', 'allocations', 'sales', 'payments', 'product_images',
  'v_sales_enriched', 'v_inventory', 'v_seller_balances',
  'v_catalog', 'v_my_inventory', 'v_my_summary', 'v_my_sales', 'v_my_monthly',
  'v_admin_seller_products',
]

for (const t of tables) {
  const r = await q(`${t}?limit=2`)
  if (r.status >= 400) {
    console.log(`✗ ${t.padEnd(24)} HTTP ${r.status}  ${JSON.stringify(r.json).slice(0, 120)}`)
  } else {
    const cols = Array.isArray(r.json) && r.json[0] ? Object.keys(r.json[0]).join(', ') : '(empty)'
    console.log(`✓ ${t.padEnd(24)} range=${r.count}  cols: ${cols}`)
  }
}

console.log('\n===== PER SELLER =====')
const sellers = (await q(`profiles?role=eq.seller&select=id,full_name`)).json
for (const s of sellers ?? []) {
  const a = await q(`allocations?seller_id=eq.${s.id}&select=id&limit=1`)
  const sa = await q(`sales?seller_id=eq.${s.id}&select=id&limit=1`)
  console.log(`  ${s.full_name.padEnd(12)} alloc=${a.count}  sales=${sa.count}`)
}

console.log('\n===== ADMIN LINKAGE =====')
const admins = (await q(`profiles?role=eq.admin&select=id,full_name,user_id`)).json
console.log('  admins:', JSON.stringify(admins))

console.log('\n===== SAMPLE v_admin_seller_products (GULSHAN) =====')
const gid = (await q(`profiles?full_name=eq.GULSHAN&select=id`)).json?.[0]?.id
const sample = await q(`v_admin_seller_products?seller_id=eq.${gid}&limit=3`)
console.log('  ', JSON.stringify(sample.json, null, 0))

console.log('\n===== SAMPLE v_seller_balances (GULSHAN) =====')
const bal = await q(`v_seller_balances?seller_id=eq.${gid}`)
console.log('  ', JSON.stringify(bal.json))
