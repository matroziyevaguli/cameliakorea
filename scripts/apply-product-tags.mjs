// One-time: apply the approved category + survey tags (docs/ordering-product-tags-proposal.md).
//   node scripts/apply-product-tags.mjs            # dry-run (validates + prints)
//   node scripts/apply-product-tags.mjs --commit   # write category + product_tags
// Idempotent: sets products.category and replaces that product's product_tags each run.
// Matches each product by a distinctive name substring; ABORTS if any rule is ambiguous or
// any active product is left unmatched, so nothing is mis-tagged.
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
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  if (r.status >= 400) throw new Error(`HTTP ${r.status} ${path}: ${JSON.stringify(j)}`)
  return j
}

// key = lowercase substring unique to one product. skin/concern empty ⇒ not in survey.
const RULES = [
  { key: 'yashil penka',        category: 'Tozalovchi',        skin: ['oily','combination','normal'],                 concern: ['oiliness','pores'] },
  { key: 'glow oil mist',       category: 'Mist',              skin: ['dry','normal'],                                concern: ['dryness','dullness'] },
  { key: 'micro whip',          category: 'Tozalovchi',        skin: ['dry','sensitive','normal','combination'],      concern: ['dryness'] },
  { key: 'ultra hydrating',     category: 'Krem',              skin: ['dry','normal','combination'],                  concern: ['dryness'] },
  { key: 'uv aqua essence',     category: 'Quyoshdan himoya',  skin: ['normal','oily','combination','sensitive','dry'], concern: ['aging','pigmentation'] },
  { key: 'round lab travel',    category: 'Toplam',            skin: ['dry','sensitive','normal'],                    concern: ['dryness'] },
  { key: 'tangerine vita',      category: 'Krem',              skin: ['normal','combination','oily'],                 concern: ['pigmentation','dullness'] },
  { key: 'perfume deodorant',   category: 'Deodorant',         skin: [],                                              concern: [] },
  { key: 'wash off pore pack',  category: 'Niqob',             skin: ['oily','combination'],                          concern: ['pores','oiliness','acne'] },
  { key: '24k gold',            category: 'Toplam',            skin: ['normal','dry','combination'],                  concern: ['aging','dullness'] },
  { key: 'abib sun stick',      category: 'Quyoshdan himoya',  skin: ['normal','oily','combination','dry','sensitive'], concern: ['aging','pigmentation'] },
  { key: 'airy tone-up',        category: 'Quyoshdan himoya',  skin: ['normal','dry','combination'],                  concern: ['pigmentation','dullness','aging'] },
  { key: 'aloe krem',           category: 'Oyoq parvarishi',   skin: [],                                              concern: [] },
  { key: 'aromatica hair',      category: 'Soch',              skin: [],                                              concern: [] },
  { key: 'sun relieve',         category: 'Quyoshdan himoya',  skin: ['sensitive','dry','normal','combination'],      concern: ['aging','pigmentation','redness'] },
  { key: 'aqua fresh',          category: 'Quyoshdan himoya',  skin: ['oily','combination','normal'],                 concern: ['pigmentation','aging'] },
  { key: 'bifida night care',   category: 'Serum / Ampula',    skin: ['normal','dry','combination'],                  concern: ['aging','dullness'] },
  { key: 'dalba',               category: 'Mist',              skin: ['dry','normal'],                                concern: ['dryness'] },
  { key: 'glutathione',         category: "Qo'shimcha (ichki)", skin: ['normal','dry','oily','combination','sensitive'], concern: ['pigmentation','dullness','aging'] },
  { key: 'nudy spray',          category: 'Sprey',             skin: [],                                              concern: [] },
  { key: 'luxury oyoq',         category: 'Oyoq parvarishi',   skin: [],                                              concern: [] },
  { key: 'medibue',             category: "Ko'z kremi",        skin: ['normal','dry','combination'],                  concern: ['aging','dryness'] },
  { key: 'snail crem (big)',    category: 'Krem',              skin: ['dry','normal','combination','sensitive'],      concern: ['dryness','aging','dullness'] },
  { key: 'snail crem (small)',  category: 'Krem',              skin: ['dry','normal','combination','sensitive'],      concern: ['dryness','aging','dullness'] },
  { key: 'realbarrier penka',   category: 'Tozalovchi',        skin: ['dry','sensitive','normal'],                    concern: ['dryness','redness'] },
  { key: 'roundlab spf',        category: 'Quyoshdan himoya',  skin: ['normal','oily','combination','dry','sensitive'], concern: ['aging','pigmentation'] },
  { key: 'tish pasta',          category: 'Tish pastasi',      skin: [],                                              concern: [] },
  { key: 'mild brightening peeling', category: 'Piling',       skin: ['normal','combination','oily'],                 concern: ['dullness','pores','pigmentation'] },
  { key: 'milk parvarishi',     category: 'Tish pastasi',      skin: [],                                              concern: [] },
  { key: 'spreyi',              category: "Og'iz parvarishi",  skin: [],                                              concern: [] },
  { key: 'collagen pdrn',       category: 'Krem',              skin: ['normal','dry','combination'],                  concern: ['aging','dullness'] },
  { key: 'sezgir tishlar',      category: 'Tish pastasi',      skin: [],                                              concern: [] },
]

const prods = await api('products?select=id,name&discontinued_at=is.null&limit=1000')

// Validate the mapping is 1:1 before touching anything.
let bad = false
const matchOf = new Map()   // product.id -> rule
for (const r of RULES) {
  const hits = prods.filter(p => p.name.toLowerCase().includes(r.key))
  if (hits.length !== 1) { console.log(`✗ rule "${r.key}" matched ${hits.length} products`); bad = true; continue }
  if (matchOf.has(hits[0].id)) { console.log(`✗ product "${hits[0].name}" matched by two rules`); bad = true }
  matchOf.set(hits[0].id, r)
}
for (const p of prods) if (!matchOf.has(p.id)) { console.log(`✗ product not matched by any rule: "${p.name}"`); bad = true }
if (bad) { console.log('\nAborted — fix the rules; nothing written.'); process.exit(1) }

console.log(`${COMMIT ? 'COMMIT' : 'DRY-RUN'} — ${prods.length} products, all matched 1:1:\n`)
for (const p of prods) {
  const r = matchOf.get(p.id)
  const survey = r.skin.length ? `skin[${r.skin.join(',')}] concern[${r.concern.join(',')}]` : '(not in survey)'
  console.log(`  ${p.name.slice(0, 42).padEnd(43)} → ${r.category.padEnd(18)} ${survey}`)
}
if (!COMMIT) { console.log('\n(dry-run — pass --commit to write)'); process.exit(0) }

for (const p of prods) {
  const r = matchOf.get(p.id)
  await api(`products?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify({ category: r.category }) })
  await api(`product_tags?product_id=eq.${p.id}`, { method: 'DELETE' })
  const rows = [
    ...r.skin.map(v => ({ product_id: p.id, tag_type: 'skin_type', tag_value: v })),
    ...r.concern.map(v => ({ product_id: p.id, tag_type: 'concern', tag_value: v })),
  ]
  if (rows.length) await api('product_tags', { method: 'POST', body: JSON.stringify(rows) })
}
console.log(`\nApplied category + tags to ${prods.length} products.`)
