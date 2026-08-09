# Admin app review — flow correctness, money/stock integrity, UX

Read-only review of `/admin/*`, `AdminNav`, and `src/lib/{expiry,image,telegramFormat}.ts`, traced against the view and trigger definitions in `docs/` (`db-guards.md`, `availability-migration-setup.md`, `sale-cancellation-views.md`, `allocation-requests-setup.md`). 15 findings: 6 that corrupt stock or money or block a core task, 8 that break on common edge cases, 2 polish. The batch-arrival pipeline, the distribute save loop, and the seller rename path are the three that need fixing first.

---

## P0 — money or stock wrong / data loss / blocks a core task

### Renaming a seller permanently locks them out of the app
`src/pages/admin/sellers.tsx:55-60` · CONFIRMED

`save()` updates `profiles.full_name` only. But the login email is *derived from the name at sign-in time*: `src/pages/login.tsx:20` builds `sellerEmail(n)` from `v_login_sellers.full_name`, and `sellerEmail` is `name.trim().toLowerCase().replace(/[^a-z0-9]/g,'') + '@sellers.local'` (`src/lib/sellerEmail.ts:4`). `src/pages/api/create-seller.ts:24` stamped the auth user with the *original* name.

**Scenario.** Seller created as "Malika" → auth user `malika@sellers.local`. Admin later fixes the display name to "Malika K." in the inline edit form. The login dropdown now shows "Malika K." and calls `signInWithPassword('malikak@sellers.local')` — an account that does not exist. Every password fails with the one generic error string. There is no password reset and no UI anywhere to change the auth email, so recovery requires direct Supabase access. The Ism field sits next to Komissiya in an ordinary edit form with no warning.

**Fix.** In `sellers.tsx`, either make `full_name` read-only in the edit form (rename becomes create + deactivate), or route the rename through a new API handler that also calls `supabase.auth.admin.updateUserById(user_id, { email: sellerEmail(newName) })` with the service client. Minimum stopgap: when `form.full_name.trim() !== s.full_name`, show a blocking inline warning naming the old and new login before enabling Saqlash.

### An inactive seller's stock is counted as free, defeating the over-allocation guard
`src/pages/admin/distribute.tsx:323` · CONFIRMED

`getServerSideProps` loads only `active = true` sellers, while `cells` (`:324`) contains **every** `v_inventory` row including inactive sellers'. Every total then sums over `sellers` only: the dropdown label (`:152-153`), `totalAssigning` (`:55-58`), `overLimit` (`:60`), and `undistributedList` (`:63-68`).

**Scenario.** Product with `total_qty` 10; deactivated seller SAIDA still holds 5. The dropdown reads "— 10 ta bo'sh" and "Taqsimlanmagan mahsulotlar" lists 10 left. Admin assigns 10 across the active sellers — `overLimit` is false, Saqlash is enabled — and the DB trigger `check_alloc_within_stock` (`docs/db-guards.md` §3) rejects mid-loop with a raw Postgres message, after some ops have already committed (see next finding).

**Fix.** `distribute.tsx:323` — drop `.eq('active', true)` and select `active` as well; render inactive sellers as a locked read-only row ("Nofaol — N ta") that still contributes to `totalAssigning` and `undistributedList`. Alternative: keep the query and fold units from `cells` keys absent from `sellers` into every total.

### A failed op in the distribute save loop leaves the DB half-applied and the client stale
`src/pages/admin/distribute.tsx:112-121` · CONFIRMED (duplicate-row consequence: PLAUSIBLE)

The loop applies ops one at a time and `return`s on the first error — **before** the `v_inventory` refetch at `:124-130`. Ops that already ran stay committed.

**Scenario.** Admin sets A 0→5 and B 3→8. A succeeds; B's update trips the stock trigger. The error shows, but `cells` still says A=0. She lowers B and presses Saqlash again — A's diff is recomputed from stale `cells` as `current === 0`, so it takes the `insert` branch (`:99-100`) against a row that now exists. Best case a duplicate-key error she cannot interpret; if `(seller_id, product_id)` carries no unique index, a second allocation row and double-counted stock (that consequence depends on schema I cannot see).

**Fix.** In the error branch (`:120`), refetch `v_inventory` into `cells` and re-prefill `qtys` before returning, so the UI shows what actually committed. Better: move the whole diff into a Postgres RPC that applies every row in one transaction.

### "Keldi" does not add stock — arrived batches can never be distributed
`src/pages/admin/batches.tsx:96-104` · CONFIRMED

`markArrived` sets `status: 'arrived'`. The only trigger on that table, `batch_arrival_sync` (`docs/availability-migration-setup.md`, Block 2), stamps `received_date` and nothing else. Nothing in `src/` writes `products.total_qty` except the products edit form and `src/pages/api/resolve-request.ts:52`. Yet `batches.tsx:121-124` tells the admin: *"kelganda «Keldi» tugmasini bosing: ombor va sayt o'zi yangilanadi."*

**Scenario.** A 20-unit batch is marked arrived. The storefront updates (it reads `v_product_availability`). `/admin/distribute` still says "0 ta bo'sh" because it reads `products.total_qty`, and any attempt to allocate the new units is rejected by `check_alloc_within_stock`. Sellers still see "Tugadi". The only recourse is hand-editing "Jami soni" on `/admin/products` — which the batches page never mentions and which is exactly the workflow batches were built to replace.

**Fix.** In `markArrived`, after the status update, also `update products set total_qty = <sum of arrived batch quantities>` for that product — the page already computes `arrivedQty` at `:129` — then refetch products. Correct the copy at `:122-123`.

### The first batch added to an existing product can empty it from the storefront
`src/pages/admin/batches.tsx:73-92` · CONFIRMED

`v_product_availability` uses `case when coalesce(b.received_qty,0) > 0 then b.received_qty else p.total_qty end`. Once **any** arrived batch exists, `total_qty` is ignored entirely for that product.

**Scenario.** Product has `total_qty` 50 with 30 sold. Admin starts using Partiyalar and records only today's shipment: a 5-unit arrived batch. `received_qty` flips from 50 to 5, `remaining = greatest(5 − 30, 0) = 0`, `state = 'sold_out'` — the product disappears from the shop and from every seller card the moment she presses "Qo'shish". Nothing warns that the first batch you add becomes the entire history.

**Fix.** In `addBatch`, when the product has no arrived batches yet and `Number(form.quantity) < p.total_qty`, show an inline warning offering to also record the pre-existing stock as an opening batch (`total_qty − quantity`, lot label "Eski qoldiq") before inserting.

### Product save blind-overwrites `total_qty` from a stale prefill; a blank field zeroes stock
`src/pages/admin/products.tsx:319-328` · CONFIRMED

`save()` sends the full row on every edit, including `total_qty: Number(form.total_qty)` prefilled at `:165` from whatever `products` state held when the modal opened. Validation at `:310-315` covers retail/discount/cost but **not** `total_qty`, and Saqlash is disabled only on `!form.name` (`:735`).

**Scenario A (lost update).** Admin opens the edit modal for X (`total_qty` 20). In another tab she approves an allocation request with "Ha, oshirilsin"; `resolve-request.ts:52` raises `total_qty` to 25. She returns to the first tab, edits only the Tavsif, presses Saqlash → stock silently drops back to 20 while allocations sum to 25, and the next distribute edit is blocked by the trigger.

**Scenario B (blank field).** She select-alls and deletes "Jami soni" intending to retype it, gets distracted, presses Saqlash → `Number('')` is `0` → stock becomes 0. Same for Mahsulot narx: an empty field saves `retail_price: 0`, making every future sale of that product zero-profit.

**Fix.** At `:310-315`, reject empty / `NaN` / negative `total_qty`, `retail_price` and `cost` (`if (form.total_qty === '' || !Number.isInteger(Number(form.total_qty)) || Number(form.total_qty) < 0)`). And when `editing && Number(form.total_qty) === editing.total_qty`, omit `total_qty` from the payload entirely so an unrelated edit cannot clobber a concurrent change.

---

## P1 — confusing or breaks on a common edge case

### Batch delete ignores its own error; a failed "Keldi" shows nothing
`src/pages/admin/batches.tsx:106-111`, `:96-104`, `:206` · CONFIRMED

`removeBatch` does `await supabase...delete()` and discards the result, then unconditionally calls `setBatches(b => b.filter(...))`. Separately, `markArrived`'s `setError` (`:102`) writes to the same `error` state that is only rendered inside the add-batch form at `:206` (`openFor === p.id &&`).

**Scenario.** RLS or an FK rejects a batch delete: the row vanishes from the screen and reappears on the next page load, so the admin believes stock history was removed when it wasn't. A "Keldi" click that fails produces no message at all — the button stops spinning and nothing changes, indistinguishable from a no-op.

**Fix.** Capture `.error` in `removeBatch` and surface it instead of filtering optimistically. Hoist the error banner out of the `openFor === p.id` block to a per-product (or page-level) position so `markArrived` and `removeBatch` errors are visible.

### The batch drift warning fires spuriously after every arrival
`src/pages/admin/batches.tsx:65-69`, `:131` · CONFIRMED

`refresh()` refetches `product_batches` only; `products` comes from SSR props and is never updated. `drift` compares the freshly recomputed `arrivedQty` against the stale `p.total_qty`.

**Scenario.** Even after the arrival fix above, marking a 5-unit batch arrived makes `arrivedQty` jump to 25 while "Ombor: 20" stays put, so the orange "Kelgan partiyalar (25) ombor soni (20) bilan mos emas" appears on a product that is now perfectly consistent — training the admin to ignore the one warning that matters.

**Fix.** Make `refresh()` also refetch `products.select('id, name, total_qty')` into a `products` state variable seeded from props.

### A partial gallery upload duplicates images on retry
`src/pages/admin/products.tsx:354-371` · CONFIRMED

The loop uploads and inserts one item at a time, returning on the first failure (`:365`) without recording which items already succeeded — `gallery` state still holds `id: null` for them.

**Scenario.** Five new result photos; #3's storage upload fails on a flaky connection. Photos 1 and 2 already have `product_images` rows. Admin presses Saqlash again → 1 and 2 are re-uploaded to fresh paths and inserted a *second* time, so the storefront gallery shows each twice. `deletedGalleryIds` (`:354`) has the mirror problem: the rows are already deleted but the ids stay in state, so the retry re-issues the delete (harmless) while the orphaned storage objects are never cleaned up.

**Fix.** After each successful insert, patch that item in state to carry its new row id (`setGallery(g => g.map((x,j) => j===i ? {...x, id: newRow.id, blob: undefined} : x))`), and clear `deletedGalleryIds` immediately after the delete succeeds, so a retry is idempotent.

### Retire / restore a product is dead code
`src/pages/admin/products.tsx:394`, `:664-675` · CONFIRMED

`retireId` is declared, the ConfirmBar row is rendered, and `setDiscontinued` is implemented at `:395-404` — but `setRetireId` is only ever called with `null` (`:399`, `:671`). No button anywhere sets it to a product id, and the `Archive` icon imported at `:9` is unused.

**Scenario.** D3 ("the first way to take a product out of the catalog without deleting its history") is unreachable from the UI — the confirm row can never render. A product already carrying `discontinued_at` from a manual SQL edit can never be brought back either: `setDiscontinued(p, false)` has no caller.

**Fix.** In the actions cell (`:644-660`), add a button beside the pencil: `p.discontinued_at ? <button onClick={() => setDiscontinued(p, false)}>` (restore, no confirm needed) `: <button onClick={() => setRetireId(p.id)}><Archive/></button>`.

### Cancelled sales permanently block a legitimate allocation correction
`src/pages/admin/requests.tsx:143`, `src/pages/api/resolve-request.ts:31-35` · CONFIRMED

The `sold` subquery in `v_allocation_requests` (`docs/allocation-requests-setup.md:87-90`) has **no** `cancelled_at is null` filter, and that view was not among the eight rebuilt in `docs/sale-cancellation-views.md`. `requests.tsx:143` computes `belowSold = r.requested_qty < r.qty_sold` from that column and disables Tasdiqlash at `:196`. The API recomputes the same floor from raw `sales`, also unfiltered.

**Scenario.** Seller records 5 sales, cancels 3 (2 real). She requests her allocation be corrected to 3. The card shows "sotilgan: 5", the red "5 ta sotilgan — bundan kam qilib bo'lmaydi", and Tasdiqlash greyed out, with no way through from this screen. `/admin/distribute` disagrees: `v_inventory.qty_sold` *does* filter cancelled sales, so the same change is permitted there. Two admin screens report a different "sotilgan" for the same seller and product.

**Fix.** Add `where cancelled_at is null` to the `sold` subquery in `v_allocation_requests`, and `.is('cancelled_at', null)` to the sales read at `resolve-request.ts:31-33`.

### Giveaways can drive a seller's inventory negative
`src/pages/admin/giveaways.tsx:38-53`, `:78` · CONFIRMED (UI) / PLAUSIBLE (DB)

`submit` validates only `productId && sellerId && qty > 0`. The product dropdown lists every product with no remaining count and is not filtered to what the chosen seller holds. `v_inventory.qty_remaining` = `qty_allocated − sold − adjustments`, and `docs/db-guards.md` defines exactly three triggers — none on `stock_adjustments` — so nothing appears to floor it at zero.

**Scenario.** Admin records a 10-unit Instagram giveaway from ADOLAT's warehouse; ADOLAT actually holds 2. The insert succeeds, her `qty_remaining` becomes −8, and `/admin/sellers/[id]` renders a negative "Qolgan". The sibling form at `sellers/[id].tsx:270` already does this correctly: `{p.product_name} (qoldi: {p.left})`.

**Fix.** Load `v_inventory` in `giveaways.tsx`'s `getServerSideProps`; filter the product dropdown to what the selected seller holds, show "(qoldi: N)" per option, and block submit when `Number(qty) > remaining`.

### One unreadable photo silently discards the entire gallery upload
`src/pages/admin/products.tsx:226-241`, `src/lib/image.ts:11-16` · CONFIRMED

`handleGalleryFiles` loops `await compressImage(file)` sequentially inside `try { } finally { setGalleryBusy(false) }` — a `finally` with **no** `catch`. `compressImage` rejects on `image.onerror`, which is exactly what an iPhone HEIC/HEIF file does in Chrome and Firefox.

**Scenario.** Admin multi-selects 4 result photos from her phone; the second is `.HEIC`. The loop throws on file 2, so `items` is discarded entirely — **none** of the 4 are added, including the ones that decoded fine. The spinner stops, the grid stays empty, no message appears, and the only trace is an unhandled rejection in the console.

**Fix.** Wrap the per-file call in its own try/catch, push the successes, and set an error string naming what was skipped ("2 ta rasm o'qib bo'lmadi (HEIC?) — JPG/PNG yuklang").

### The dashboard prices remaining stock two different ways on the same screen
`src/pages/admin/index.tsx:222-259`, `:141-149` · CONFIRMED

"Ombor qiymati" / "Omborda turgan pul" / "Kutilayotgan foyda" use `v_product_availability.remaining` (`:222-251`), which is `received_qty − units_sold` and **never subtracts `stock_adjustments`**. The "Mahsulot hisoboti" table's Qoldi column, twenty lines lower, uses `v_product_stats.units_remaining` = `total_qty − sold − adjustments` (`docs/sale-cancellation-views.md:167-178`) — a different base *and* a different formula.

**Scenario.** Product with `total_qty` 30, 10 sold, 5 given away, one arrived 30-unit batch. The Qoldi column says 15 while the metric above values 20 units — and those 5 giveaway units are simultaneously counted as a marketing cost in the "Sovg'alar" tile (`:252-259`), double-counted in the same viewport.

**Fix.** Subtract adjustments in `v_product_availability` (`greatest(received_qty − units_sold − adjustments, 0)`), which also corrects the seller-facing storefront, and drive the Qoldi column from that same source.

---

## P2 — polish

### The requests inbox has no ordering or limit
`src/pages/admin/requests.tsx:348-350` · CONFIRMED

Three views are read with `.select('*')` and no `.order()`; `v_allocation_requests` (`docs/allocation-requests-setup.md:74`) has no `ORDER BY` of its own. Pending cards therefore appear in whatever order the join plan produces and reshuffle between loads, and the collapsed "Ko'rib chiqilgan" history ships every resolved request ever in `props` on each page view. (`v_giveaways` *does* carry `order by created_at desc`, so that page is unaffected.)

**Fix.** Add `.order('created_at', { ascending: false })` to all three queries, plus `.limit(50)` on the resolved history.

### Clicking outside the product modal discards everything, silently
`src/pages/admin/products.tsx:713` · CONFIRMED

The backdrop's `onClick` calls `cancel()` on any click that lands outside the panel — losing a typed form, an AI-generated description, a cropped cover photo, and a queued multi-image gallery at once, with no confirmation. Every other destructive action on this page was given a `ConfirmBar`.

**Fix.** Only close on backdrop click when the form is untouched; otherwise route it through the same inline confirm pattern.

---

## The three highest-leverage fixes

1. **`batches.tsx` — make "Keldi" actually move stock**, and guard the first-batch override. The whole Partiyalar → Taqsimlash pipeline is currently a dead end that contradicts its own on-screen instructions, and the workaround (hand-editing "Jami soni") is precisely the problem batches were built to replace.
2. **`sellers.tsx` — stop the rename lockout.** One keystroke in a field with no warning permanently locks a seller out, with no self-service recovery. Cheapest fix on this list (make the field read-only), most expensive failure.
3. **`distribute.tsx` — count inactive sellers, and recover from a partial save.** These compound: the invisible-stock bug is what *triggers* the mid-loop failure, and the stale-state retry is what turns it into potentially duplicated allocation rows. Fixing the seller query and refetching `cells` in the error branch closes both.
