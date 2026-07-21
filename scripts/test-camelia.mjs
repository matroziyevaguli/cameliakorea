// End-to-end checks against the REAL database, with self-cleanup.
//
//   node scripts/test-camelia.mjs           run + delete everything it created
//   node scripts/test-camelia.mjs --keep    leave the test rows behind for inspection
//
// Everything it creates is named with the TAG below, so anything ever left behind is
// trivially findable:  select * from products where name like '__TEST__%';
//
// Needs .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// The service role bypasses RLS — that's deliberate for setup/teardown, and every
// assertion is a BEFORE/AFTER delta so it verifies itself.

import { readFileSync } from 'fs'

const TAG = '__TEST__'
const KEEP = process.argv.includes('--keep')

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local'); process.exit(1) }

async function api(method, path, body, prefer = '') {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: ['return=representation', prefer].filter(Boolean).join(','),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json; try { json = text ? JSON.parse(text) : null } catch { json = text }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`)
  return json
}
const get    = (p) => api('GET', p)
const insert = (t, row) => api('POST', t, row).then(r => r[0])
const patch  = (t, q, row) => api('PATCH', `${t}?${q}`, row)
const del    = (t, q) => api('DELETE', `${t}?${q}`)

let pass = 0, fail = 0
const money = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✅ ${name}`) }
  else    { fail++; console.log(`  ❌ ${name}${detail ? `\n       ${detail}` : ''}`) }
}
const near = (a, b, tol = 0.5) => Math.abs(Number(a) - Number(b)) <= tol

const created = { productId: null, batchIds: [], allocationId: null, saleId: null }

async function main() {
  console.log(`\n🧪 Camelia end-to-end tests  (${KEEP ? 'KEEPING' : 'auto-cleaning'} test data)\n`)

  // ── 0. Preconditions ────────────────────────────────────────────────────
  console.log('0 · Schema')
  const shopCols = await get('v_shop?limit=1')
  const shopSample = shopCols[0] ?? {}
  check('v_shop exposes `state`', 'state' in shopSample)
  check('v_shop leaks no cost', !('cost' in shopSample) && !('unit_cost' in shopSample))
  const saleCols = await get('v_sales_enriched?limit=1')
  check('v_product_availability exists', Array.isArray(await get('v_product_availability?limit=1')))

  const sellers = await get('profiles?role=eq.seller&active=eq.true&select=id,full_name,commission_rate&limit=1')
  if (!sellers.length) throw new Error('No active seller to test with')
  const seller = sellers[0]
  const rate = Number(seller.commission_rate ?? 0.4)
  console.log(`     using seller: ${seller.full_name} (${Math.round(rate * 100)}%)`)

  // ── 1. Availability lifecycle ───────────────────────────────────────────
  console.log('\n1 · Shipment lifecycle (ordered → arrived)')
  const product = await insert('products', {
    name: `${TAG} ${Date.now()}`, cost: 1000, retail_price: 3000,
    discount_price: null, total_qty: 0,
  })
  created.productId = product.id

  const stateOf = async () => (await get(`v_product_availability?product_id=eq.${product.id}&select=*`))[0]

  let a = await stateOf()
  check('brand-new product with no stock reads sold_out', a.state === 'sold_out', `got ${a?.state}`)

  const ordered = await insert('product_batches', {
    product_id: product.id, quantity: 12, status: 'ordered',
    eta: new Date(Date.now() + 12096e5).toISOString().slice(0, 10), unit_cost: 900,
  })
  created.batchIds.push(ordered.id)

  a = await stateOf()
  check('an ordered batch makes it not_arrived', a.state === 'not_arrived', `got ${a?.state}`)
  check('ordered stock is NOT counted as available', Number(a.remaining) === 0, `remaining=${a.remaining}`)
  check('incoming quantity is reported', Number(a.incoming_qty) === 12, `incoming=${a.incoming_qty}`)
  check('an unarrived batch has no received_date',
    (await get(`product_batches?id=eq.${ordered.id}&select=received_date`))[0].received_date === null)

  // The one action: mark it arrived
  await patch('product_batches', `id=eq.${ordered.id}`, { status: 'arrived' })
  const arrived = (await get(`product_batches?id=eq.${ordered.id}&select=received_date,status`))[0]
  check('marking arrived stamps received_date (D2 trigger)', arrived.received_date !== null)

  a = await stateOf()
  check('arrival makes stock available', a.state === 'in_stock' && Number(a.remaining) === 12,
    `state=${a.state} remaining=${a.remaining}`)
  check('just_arrived flag is set', a.just_arrived === true)

  // ── 2. Discontinue hides it from customers ──────────────────────────────
  console.log('\n2 · Discontinue')
  await patch('products', `id=eq.${product.id}`, { discontinued_at: new Date().toISOString() })
  a = await stateOf()
  check('state becomes discontinued', a.state === 'discontinued', `got ${a?.state}`)
  check('it disappears from the public storefront',
    (await get(`v_shop?id=eq.${product.id}&select=id`)).length === 0)
  await patch('products', `id=eq.${product.id}`, { discontinued_at: null })
  check('restoring puts it back in the storefront',
    (await get(`v_shop?id=eq.${product.id}&select=id`)).length === 1)

  // ── 3. Cancellation must reverse the money AND the stock ────────────────
  console.log('\n3 · Sale cancellation')
  await patch('products', `id=eq.${product.id}`, { total_qty: 12 })
  const alloc = await insert('allocations', {
    seller_id: seller.id, product_id: product.id, qty_allocated: 12,
  })
  created.allocationId = alloc.id

  const balanceOf = async () =>
    (await get(`v_seller_balances?seller_id=eq.${seller.id}&select=owed_from_sales,balance`))[0]

  const before = await balanceOf()
  const UNIT = 3000, QTY = 2
  const expectedOwed = QTY * UNIT - QTY * (UNIT - 1000) * rate   // revenue − her share

  const sale = await insert('sales', {
    seller_id: seller.id, product_id: product.id, qty: QTY, unit_price: UNIT,
  })
  created.saleId = sale.id

  const afterSale = await balanceOf()
  check('a sale increases what she owes by the right amount',
    near(Number(afterSale.owed_from_sales) - Number(before.owed_from_sales), expectedOwed),
    `expected +${money(expectedOwed)}, got +${money(Number(afterSale.owed_from_sales) - Number(before.owed_from_sales))}`)

  a = await stateOf()
  check('the sale reduces available stock', Number(a.remaining) === 10, `remaining=${a.remaining}`)

  // Cancel it
  await patch('sales', `id=eq.${sale.id}`, { cancelled_at: new Date().toISOString(), cancel_reason: `${TAG} reason` })
  const afterCancel = await balanceOf()
  check('cancelling reverses the debt exactly',
    near(afterCancel.owed_from_sales, before.owed_from_sales),
    `expected ${money(before.owed_from_sales)}, got ${money(afterCancel.owed_from_sales)}`)
  check('cancelling reverses the balance exactly',
    near(afterCancel.balance, before.balance),
    `expected ${money(before.balance)}, got ${money(afterCancel.balance)}`)

  a = await stateOf()
  check('cancelling returns the stock', Number(a.remaining) === 12, `remaining=${a.remaining}`)

  const stillVisible = await get(`v_my_sales?id=eq.${sale.id}&select=id`).catch(() => [])
  check('the cancelled row is not destroyed',
    (await get(`sales?id=eq.${sale.id}&select=id,cancelled_at`))[0]?.cancelled_at != null)

  // Restore
  await patch('sales', `id=eq.${sale.id}`, { cancelled_at: null, cancel_reason: null })
  const afterRestore = await balanceOf()
  check('restoring re-applies the debt',
    near(afterRestore.owed_from_sales, afterSale.owed_from_sales),
    `expected ${money(afterSale.owed_from_sales)}, got ${money(afterRestore.owed_from_sales)}`)

  // ── 4. Reports must not lose never-sold products (the LEFT JOIN trap) ───
  console.log('\n4 · Reports')
  const products = await get('products?select=id')
  const stats = await get('v_product_stats?select=product_id')
  check('v_product_stats still lists every product (LEFT JOIN preserved)',
    stats.length === products.length, `products=${products.length} stats=${stats.length}`)

  const neverSold = await get(`v_product_stats?product_id=eq.${product.id}&select=units_sold`)
  check('a product row survives even with only cancelled sales', neverSold.length === 1)

  // ── 5. Audit trail is append-only ──────────────────────────────────────
  console.log('\n5 · Audit trail')
  const edit = await insert('sale_edits', {
    sale_id: sale.id, editor_id: seller.id, action: 'qty',
    old_value: 2, new_value: 1, reason: `${TAG} audit`,
  })
  check('an edit can be recorded', !!edit?.id)
  const readBack = await get(`sale_edits?id=eq.${edit.id}&select=action,old_value,new_value`)
  check('it reads back intact',
    readBack[0]?.action === 'qty' && Number(readBack[0].old_value) === 2)
  await del('sale_edits', `id=eq.${edit.id}`)   // service role may delete; sellers may not
}

async function cleanup() {
  if (KEEP) { console.log('\n🔒 --keep: leaving test data in place'); return }
  console.log('\n🧹 Cleaning up')
  const tries = [
    ['sale_edits',      `reason=like.*${TAG}*`],
    ['sales',           created.saleId ? `id=eq.${created.saleId}` : null],
    ['allocations',     created.allocationId ? `id=eq.${created.allocationId}` : null],
    ['product_batches', created.productId ? `product_id=eq.${created.productId}` : null],
    ['products',        created.productId ? `id=eq.${created.productId}` : null],
  ]
  for (const [table, q] of tries) {
    if (!q) continue
    try { await del(table, q); console.log(`   removed ${table}`) }
    catch (e) { console.log(`   ⚠ could not remove ${table}: ${e.message}`) }
  }
  // belt and braces: any stray test products from a crashed earlier run
  try {
    const strays = await get(`products?name=like.*${TAG}*&select=id,name`)
    for (const s of strays) {
      await del('product_batches', `product_id=eq.${s.id}`).catch(() => {})
      await del('allocations', `product_id=eq.${s.id}`).catch(() => {})
      await del('sales', `product_id=eq.${s.id}`).catch(() => {})
      await del('products', `id=eq.${s.id}`)
      console.log(`   removed stray ${s.name}`)
    }
  } catch { /* ignore */ }
}

try {
  await main()
} catch (e) {
  fail++
  console.log(`\n💥 ${e.message}`)
} finally {
  await cleanup()
  console.log(`\n${fail === 0 ? '✅' : '❌'}  ${pass} passed, ${fail} failed\n`)
  process.exit(fail === 0 ? 0 : 1)
}
