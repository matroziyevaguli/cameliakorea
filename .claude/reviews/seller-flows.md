# Seller app — flow review (`/seller/*`)

Read-only review of the seller pages, shared components and libs against `docs/ux-walkthrough.md` §2, `docs/redesign.md`, `docs/seller-page-plan.md` and `docs/seller-redesign-todo.md`. 16 findings: 4 that can lose a sale or double-count stock and money, 9 that break on ordinary edge cases, 3 polish. CONFIRMED = traced end to end in code; PLAUSIBLE = depends on DB/RLS behaviour not observable from the repo.

---

## P0 — data loss / wrong stock or money

### A successful sale can be queued again and inserted twice

`src/pages/seller/sell.tsx:92-115` — **CONFIRMED**

The insert sits inside the same `try` as the `canvas-confetti` dynamic import and the `v_my_sales` profit read:

```ts
const { data: inserted, error: insertErr } = await supabase.from('sales').insert(payload).select('id').single()
if (insertErr || !inserted) { ...; return }
const { data: sale } = await supabase.from('v_my_sales')...
const confetti = (await import('canvas-confetti')).default   // ← chunk fetch over the network
...
} catch {
  addPending({ ...payload, client_ts: Date.now() })           // ← re-queues an ALREADY-INSERTED sale
  setResult({ profit: null, amount, saleId: null, offline: true })
}
```

**Scenario:** seller taps "Ha, sotildi" on a weak connection. The insert succeeds. The `canvas-confetti` chunk fetch then fails (or `confetti()` throws) → the `catch` fires → the already-recorded sale is written to the localStorage queue → she sees the calm orange "Saqlandi ⏳" screen → the home page flushes the queue → the same unit is sold twice. Stock drops by 2; her debt and her profit both double.

**Fix:** track whether the row was written and never queue after that point.

```ts
let savedId: string | null = null
try {
  const { data: inserted, error: insertErr } = await supabase.from('sales').insert(payload).select('id').single()
  if (insertErr || !inserted) { setError(friendlyError(insertErr?.message)); setLoading(false); return }
  savedId = inserted.id
  ...
} catch {
  if (savedId) { setUndoSecs(10); setResult({ profit: 0, amount, saleId: savedId, offline: false }) }
  else { addPending({ ...payload, client_ts: Date.now() }); setResult({ profit: null, amount, saleId: null, offline: true }) }
  setLoading(false)
}
```

### The offline queue never triggers on the failure mode that actually happens

`src/pages/seller/sell.tsx:87-96` — **CONFIRMED**

Queueing happens only when `navigator.onLine === false`. But supabase-js does **not** throw on a network failure — verified in `node_modules/@supabase/postgrest-js/src/PostgrestBuilder.ts:391-456`: a failed fetch is returned as `{ error: { message: "TypeError: Failed to fetch", code: '' }, status: 0 }`. The `catch` at line 111 is therefore dead for network errors, and line 96 handles them as ordinary errors.

**Scenario** (the common one on an Uzbek phone: bars showing, no working data): `navigator.onLine === true`, the insert fails at the transport layer → she sees `"Xatolik — qayta urinib ko'ring"` and the sale is silently dropped, never queued. Worse: if the request reached PostgREST but the response was lost, the row *was* written — she taps again → duplicate sale.

**Fix:** capture `status` and treat `0` as offline, before the generic error branch.

```ts
const { data: inserted, error: insertErr, status } = await supabase
  .from('sales').insert(payload).select('id').single()
if (status === 0) {
  addPending({ ...payload, client_ts: Date.now() })
  setResult({ profit: null, amount, saleId: null, offline: true }); setLoading(false); return
}
```

Related context: `public/sw.js` deliberately caches nothing, so a fully offline seller cannot even load `/seller/sell` (an SSR page). The queue's only reachable use is exactly this flaky-connection case — which today it does not catch. This fix is what makes T8 real.

### Concurrent queue flush inserts every pending sale twice

`src/lib/pendingSales.ts:33-45` and `src/pages/seller/index.tsx:180-195` — **CONFIRMED**

`flushPending` has no in-flight guard, and `sync()` is bound to both mount and the `online` event. Mobile networks fire `online` repeatedly when a connection flaps. Two overlapping `sync()` calls both read the same `getPending()` array and both `insert` every row before either reaches `removePending` → each queued sale is inserted twice.

Separately, `client_ts` is documented as the dedupe key (`docs/seller-redesign-todo.md` T8) but is never sent to the DB — `pendingSales.ts:38-40` omits it. There is no server-side idempotency at all, so any flush whose response is lost duplicates on the next run.

**Fix (minimal):** module-level guard in `pendingSales.ts`:

```ts
let flushing = false
export async function flushPending(supabase: SupabaseClient): Promise<number> {
  if (flushing) return 0
  flushing = true
  try { /* existing body */ } finally { flushing = false }
}
```

**Fix (proper):** add a `client_ts` column with a unique index on `(seller_id, client_ts)`, include it in the insert, and treat error `23505` as success so the row is dropped from the queue.

### "Bekor qilish" undo reports success even when the delete fails

`src/pages/seller/sell.tsx:118-123` — **CONFIRMED**

```ts
await supabase.from('sales').delete().eq('id', result.saleId)   // error ignored
router.push('/seller')
```

No error check, no busy state. If the delete fails — dropped connection right after the sale, the likeliest moment — she is navigated home believing the sale was undone, while the row stands and counts toward her debt and against her stock. Her only recovery is finding it on Sotuvlarim, which she has no reason to look for.

**Fix:** check the error, keep the success screen on failure, and show `"Bekor qilib bo'lmadi — «Sotuvlarim»da bekor qiling"`. Disable the button while the request is in flight.

---

## P1 — confusing, or breaks on a common edge case

### After an offline flush the product cards keep the pre-sale counts

`src/pages/seller/index.tsx:263` and `src/pages/seller/index.tsx:187` — **CONFIRMED**

`const [products, setProducts] = useState<Product[]>(initialProducts)` initialises once. Line 187 refreshes with `router.replace(router.asPath)` — same route, same component instance, no remount — so Next replaces `pageProps` but the `products` state is never re-seeded.

**Scenario:** 2 queued sales flush → the green "2 ta sotuv yuborildi ✓" banner appears and the header profit + money strip update (they read props directly), but every product card still shows the old `remaining`/`sold`. She may then sell a unit she no longer has.

**Fix:** in `index.tsx`, `useEffect(() => setProducts(initialProducts), [initialProducts])` — or replace the `router.replace` at line 187 with a client re-read of `v_my_inventory` into `setProducts`, which is also what G2 asks for.

### "Yig'ilishi kerak" is the same label on two different numbers

`src/consts/strings.ts:48,58` · `src/pages/seller/index.tsx:358` · `src/pages/seller/balance.tsx:74-76` — **CONFIRMED**

`S.moneyCollect` and `S.toHandOver` are both the literal string `"Yig'ilishi kerak"`, but they are rendered against different fields:

- home money strip → `summary.not_submitted` (still outstanding)
- Hisobim card → `summary.total_owed` (lifetime owed, including everything already handed over)

The home tile links straight to that page. **Scenario:** a seller who has collected 3 000 000 and handed over 2 500 000 sees "Yig'ilishi kerak 500 000" on home, taps it, and lands on "Yig'ilishi kerak 3 000 000". This is precisely the confusion the §1.2 glossary exists to prevent.

**Fix:** in `balance.tsx:74` use a distinct term for the lifetime figure — `S.cameliaShare` ("Camelia'ga tegishli") already exists and is used for the same number at line 100. Reserve `S.moneyCollect` / `S.stillOwed` for `not_submitted`.

### A failed cancel or restore is completely invisible

`src/pages/seller/sales.tsx:102,116` — **CONFIRMED**

`doCancel` and `doRestore` write their error into `editError`, but `editError` is only rendered at line 360 — inside the `isEditing` branch, which is never open during a cancel.

**Scenario:** she taps "Ha, bekor qilish"; the update fails (RLS, network) → `busy` clears, the confirm card stays, nothing changes, no message appears. She taps again, and again.

**Fix:** add a `rowError: { id: string; msg: string } | null` state and render it inside the cancel/restore block; or move the `editError` render outside the `isEditing` branch.

### Delete ignores its own result, so the row flickers back with no explanation

`src/pages/seller/sales.tsx:253-261` — **CONFIRMED**

```ts
await supabase.from('sales').delete().eq('id', id)   // no error check
setSales(list => list.filter(s => s.id !== id))       // optimistic
reconcile()
```

**Scenario:** the delete fails; the row disappears and then reappears a second later when `reconcile()` returns, with no error text. If `reconcile()` also fails (same dead network), the sale stays hidden from her list while still counting in the DB and in every money total.

**Fix:** destructure `{ error }`, surface it in the same row-error slot as the finding above, and only filter optimistically when it is null.

### Raw Postgres / English errors are shown to a non-technical Uzbek user

`src/pages/seller/sales.tsx:102,116,145,166` — **CONFIRMED**

Four call sites do `setEditError(error.message)` / `setPriceErr(error.message)`. The most likely to fire is the DB oversell guard behind line 143: the qty stepper at line 353 (`setEditQty(q => q + 1)`) has no upper bound, so she can raise a sale of 1 to 20 with no client-side check and gets back whatever the trigger or RLS says — e.g. `new row violates row-level security policy for table "sales"`. This contradicts T10 ("no raw English errors").

**Fix:** lift the `friendlyError()` helper already written in `sell.tsx:34-39` into a shared module (`src/lib/errors.ts` or `src/lib/format.ts`) and wrap all four sites. Separately, cap the edit stepper at the sale's original qty plus the product's current `remaining`.

### The "Hozir" column and before→after go stale right after accepting a return

`src/pages/seller/transfers.tsx:78,242,316` — **CONFIRMED**

`reconcile()` re-reads `v_my_transfers` only. `remainingByProduct` is an SSR prop and is never refreshed.

**Scenario:** she taps "Qabul qildim" on 3 units. The card disappears (correct), but the "Hozir" column for that product still shows the old count, and if a second return of the same product is pending, its "Sizda 5 → qabul qilsangiz 8" line is now wrong by 3. That before→after line is the entire point of the page.

**Fix:** in `reconcile()`, also `supabase.from('v_my_inventory').select('product_id, remaining')` and hold `remainingByProduct` in state seeded from the prop.

### A seller can promise the same units twice, and the receiver eats the error

`src/pages/api/transfer-request.ts:26-36` and `src/pages/seller/transfers.tsx:135,152` — **CONFIRMED**

The API computes `remaining = allocated − sold − adjustments` and does not subtract pending outgoing transfers; neither does `v_my_inventory` (`docs/new-views.md:30`). Holding 5 units she can send 5 to ADOLAT and 5 to SAIDA — both requests validate. The `approve_transfer` RPC does guard (`src/pages/api/confirm-transfer.ts:31`), so the *second receiver* gets "Yuboruvchida yetarli sotilmagan mahsulot yo'q" — an error about someone else's stock, on someone else's screen. The sender is never told.

Compounding it client-side: after `sendDone`, `sendable` / `remainingByProduct` are not refreshed (line 152 reconciles transfers only), so the dropdown still offers "(5 ta)". And there is no way to withdraw a pending transfer sent by mistake — no button, no API — so it sits pending forever unless the recipient acts.

**Fix (minimal):** in `transfer-request.ts`, subtract `sum(qty) from transfers where from_seller_id = prof.id and product_id = … and status = 'pending'` before the `qty > remaining` check, and mirror that number in the form's max. **Follow-up worth doing:** a "Bekor qilish" action on the sender's own pending rows setting `transfers.status = 'cancelled'` where `from_seller_id = me and status = 'pending'`.

### A seller with no sales yet hits a dead-end screen with no navigation

`src/pages/seller/balance.tsx:29-33` — **CONFIRMED**

```ts
if (!summary) return <div className="min-h-screen …"><p>{S.noData}</p></div>
```

No `SellerNav`, no header, no back link. `v_my_summary` is read with `.maybeSingle()`, so a brand-new seller — or any RLS hiccup — gets a blank cream screen reading "Ma'lumot topilmadi", and the only way out is the browser's back gesture, which an installed PWA does not offer. Two of the four home money tiles link here (`index.tsx:357-359`), as does the "Hisobim" tab.

**Fix:** render the normal gradient header and `<SellerNav />` around the empty state, and make the copy useful: `"Hali sotuv yo'q — birinchi sotuvingizdan keyin bu yerda pul hisobi chiqadi."`

### With one product in the list, the card cannot be collapsed

`src/pages/seller/sales.tsx:243-250` — **CONFIRMED**

```ts
useEffect(() => {
  if (groups.length === 1) { setOpenKey(groups[0].key); return }   // ← runs before the `touched` guard
  if (!touched && groups.length > 0) setOpenKey(groups[0].key)
}, [groups, touched])
```

`toggle()` sets `touched → true`, which is a dependency, so the effect re-runs, hits the unconditional first branch, and re-opens the card she just closed. Triggers whenever she has one product, or searches down to one — the common case on this page.

**Fix:** move the single-group case behind the `touched` guard; `if (!touched && groups.length > 0) setOpenKey(groups[0].key)` already covers it.

---

## P2 — polish

### Four full money amounts in a four-column strip on a 360px phone

`src/pages/seller/index.tsx:354-366` — **CONFIRMED (layout arithmetic)**

Each tile gets ~90px minus `px-2` padding ≈ 74px of text width, while `formatUZS` renders `"1 200 000 so'm"` at `text-sm`. Every tile wraps to three or four lines; with `.big-text` (18.5px root — the accessibility mode built for these very users, `src/styles/globals.css:222`) it is worse. `redesign.md` §4.1 asks for "4 mini-tiles… a compact secondary summary".

**Fix:** add `formatUZSShort()` to `src/lib/format.ts` producing `"1.2 mln"` / `"850 ming"` and use it in the strip only; Hisobim keeps the full amounts.

### First launch shows a badge of ~40 unread notifications of ancient history

`src/components/NotificationBell.tsx:111,170` — **CONFIRMED**

`unread` counts `!seenAt || i.at > seenAt`, so with no stored watermark *everything* is unread — and every payment ever recorded is a notification (lines 94-103). A seller installing the app on a new phone sees a red "40". Tapping any single item calls `markAllRead()` (line 170), silently clearing items she never saw.

**Fix:** on first mount, when `SEEN_KEY` is absent, write `new Date().toISOString()` rather than treating all history as new. On an item tap, advance the watermark only to that item's `at` when it is the newest.

### Dead code and unordered lists

- `src/pages/seller/sales.tsx:174-188` — `submitPriceRequest` (with `priceBusy` / `priceDone`) is never called; G4 replaced it with `savePriceDirect`. The `"Narx so'rovi yuborildi"` branch at line 371 is now reachable only from legacy rows. **CONFIRMED**
- `src/pages/seller/index.tsx:800,812` — `totalUnitsSold` is computed, passed as a prop and never rendered. **CONFIRMED**
- `src/pages/seller/requests.tsx:98-101` — neither query has `.order('created_at', { ascending: false })`, and price requests are appended after allocation requests rather than interleaved, so "what happened most recently" is not readable. **CONFIRMED**

---

## The three highest-leverage fixes

1. **Make the sale write idempotent end to end** (P0 findings 1-3): move the insert out of the catchable block, queue on `status === 0` instead of `!navigator.onLine`, and add an in-flight guard (ideally a `client_ts` unique index) to `flushPending`. This is the only place in the app where a bug silently changes stock *and* money, and all three defects sit on the single most-used path.
2. **One error surface for every seller write**: lift `friendlyError()` out of `sell.tsx` into a shared module and route the four `sales.tsx` sites and `undo()` through a visible per-row error slot. Today four distinct failure paths produce either silence or raw Postgres English.
3. **Refresh what a write changed**: re-seed `products` from props on the home page and re-read `v_my_inventory` in `transfers.reconcile()`. Both pages currently show the seller a number she has just made wrong — exactly the trust the "Hozir / before→after" design was built to create.
