# Camelia redesign — progress

Live tracker for `docs/redesign.md` (UI) and `docs/availability_plan.md` (data).
**Update this file whenever a box is ticked.** Every claim here is verifiable —
the "proof" column says how it was checked.

Legend: ✅ done & verified · 🟡 partly done · ⬜ not started · 🔒 blocked on SQL

**Last updated:** 2026-07-22 · **Phases 1 + 3: ✅ complete** (pending your visual check)

**Build status:** `yarn build` ✅ passes · `tsc --noEmit` → 2 errors, both **pre-existing**
recharts `Tooltip formatter` typings in `admin/index.tsx` and `admin/stats.tsx`
(verified by stashing all changes and re-running: same 2). `next.config.js` sets
`ignoreBuildErrors: true`, so they don't block deploys.

---

## Where things stand

| Phase | Depends on | Status |
|---|---|---|
| **1 · Grammar pass** | nothing | ✅ **done** |
| **2 · Single stock signal** | D4, D5 | 🔒 SQL not written yet |
| **3 · Seller IA** | nothing | 🟡 **done except G4** (needs SQL) |
| **4 · Admin Stock Hub** | D1, D2 | 🔒 |
| **5 · Admin regroup + money truth** | D6 | 🔒 |
| **6 · Polish** | — | ⬜ |

### Data migrations (`availability_plan.md` §8)
| ID | What | Status |
|---|---|---|
| D1 | `product_batches.status` / `ordered_date` / `eta` / `unit_cost` | ⬜ SQL not written |
| D2 | Arrival invariant trigger (`arrived ⇔ received_date`) | ⬜ |
| D3 | `products.discontinued_at` | ⬜ |
| D4 | `v_product_availability` (`state` enum) | ⬜ |
| D5 | `v_catalog` (anon, no cost, exposes `state`) | ⬜ |
| D6 | Flip stock source to derived; correct `invested`/`worth` | ⬜ |
| **D7** | *(new)* `sales.cancelled_at` + `cancel_reason`, `sale_edits` audit table — needed by **G4** | ⬜ |

> ⚠ **`v_upcoming` must stay un-run.** `availability_plan.md` §7 retires it.
> `docs/upcoming-products-setup.md` is superseded — do not execute it.

---

## Phase 1 — Grammar pass ✅

No data changes. Shipped in commits on `main`.

### G1 · One confirmation pattern ✅
Built **`src/components/ConfirmBar.tsx`** (full + `compact` variant for table cells).
Replaced **every** native dialog:

| Was | File | Now |
|---|---|---|
| `confirm(S.deleteConfirm)` | `seller/index.tsx` (Tuzatish modal) | inline ConfirmBar |
| `confirm("Bu partiyani…")` | `admin/batches.tsx` | inline ConfirmBar |
| `confirm("…to'liq to'lov…")` | `admin/payments.tsx` "To'liq ✓" | compact ConfirmBar |
| `confirm("Bu to'lovni…")` | `admin/payments.tsx` history trash | compact ConfirmBar |
| `window.confirm("Omborda N ta…")` | `admin/requests.tsx` stock bump | inline ConfirmBar |

**Proof:** `grep -rn "confirm(" src/pages src/components` → no native calls remain.

### G2 · One refresh model ✅ (for pages Phase 3 keeps)
Converted from SSR-reload (`router.replace(router.asPath)`) to **optimistic update +
background reconcile**:

- `seller/sales.tsx` — qty edit, delete, price request. Added `reconcile()` re-reading
  `v_my_sales` so profit still comes from the view, never computed client-side.
- `seller/transfers.tsx` — confirm/reject and new transfer.
- `admin/giveaways.tsx`, `admin/sellers.tsx`, `admin/sellers/[id].tsx`.

**Deliberately deferred:** `seller/index.tsx` still reloads. Its remaining writes live
in the **Tuzatish modal, which Phase 3 deletes** — converting them now is work thrown
away ("ordered so nothing is built twice", redesign.md §6).

### G3 · One vocabulary ✅
`src/consts/strings.ts` now carries the Pipeline-B terms from §1.2 as canonical
constants (`moneyCollect`, `moneyHandedOver`, `moneySettled`, `earningsSeller`,
`earningsAdmin`), applied at every call site:

| Concept | Was (seller / admin) | Now, both |
|---|---|---|
| Owed to Camelia | "Topshirilishi kerak" / "Yig'ilishi kerak" | **Yig'ilishi kerak** |
| Cash handed over | "Topshirilgan" / "Yig'ilgan" / "Topshirgan" | **Topshirildi** |
| Kept profit | "Daromadingiz" / "Mening foydam" | **Daromadingiz** / **Mening daromadim** |

"foyda" → "daromad" throughout the payments explainer and seller detail cards.

> 🔎 **Wants your eye:** the seller's home card now reads **"Yig'ilishi kerak"** where
> it said "Topshirilishi kerak". That's §1.2 applied literally (one word, both apps),
> but "to be collected" is passive from her side — *she* does the handing over. If it
> reads wrong to Gulshan, the fix is one string: `S.toHandOver = "Topshirasiz"`.

### G6 · aria-labels ✅
Added to every icon-only button (X / Trash2 / Pencil / Minus / Plus / ChevronLeft /
MoreHorizontal) across 8 files: landing, seller home, sales, transfers, sell, admin
batches, sellers, products.

### G7 · Identity by id ✅
`seller/sales.tsx` keyed sale thumbnails on `product_name`. Now it reads `product_id`
from the base `sales` table (RLS-safe, own rows) and looks the photo up by
`v_catalog.id`. **Renaming a product no longer wipes its sale history photos.**

### G8 · Login recovery ✅
- Distinct errors: `S.loginWrongPassword` ("Parol noto'g'ri…") vs `S.loginNetworkError`.
  Since the name comes from a fixed dropdown it's always a real account, so invalid
  credentials can only mean the password — and now it says so.
- Added **"Parolni unutdingizmi? Guliga yozing"** → `SELLER_CONFIG.adminTelegramUrl`.

### Phase 1 acceptance (redesign.md §6)
| Criterion | Status |
|---|---|
| No native dialog remains | ✅ grep-verified |
| Term grep finds only canonical words | ✅ |
| Renaming a product keeps sale thumbnails | ✅ by construction (id-keyed) |
| A mistyped login says which field | ✅ |

**⚠ Not yet verified by running the app** — `node_modules` isn't installed in this
checkout, so there's been no typecheck and no build. Run `yarn && yarn dev` (or check
the Vercel preview) and confirm the five confirm-flows and the login copy.

---

## Phase 2 — Single stock signal 🔒

Blocked: needs D4 + D5.

- [ ] Write + run the D1–D5 migration SQL
- [ ] Seller card: four "how much is left" signals → **one** `state` badge
- [ ] Per-unit pills move into the stock-detail sheet
- [ ] Storefront cards read `state`; **retire the `Tez orada` section**
- [ ] Remove every `v_upcoming` reference

**Done when:** every card shows exactly one stock line, and a customer can tell
`Tugadi` from `Tugadi — yo'lda`.

> Note: the `Tez orada` section shipped in `a65316c` is **still live but inert** —
> `v_upcoming` doesn't exist, the fetch fails soft, the section doesn't render.

---

## Phase 3 — Seller IA 🟡 (everything except G4)

- [x] **Nav → 4 tabs** — Sotish · Sotuvlarim · Hisobim · Qaytarish. Settings dropped out
      of the tab bar (now the ⚙ in the header), so the four that remain get bigger
      targets (`w-6` icons, `py-3`). `src/components/SellerNav.tsx`.
- [x] **🔔 notification centre** — `src/components/NotificationBell.tsx`. Aggregates four
      sources: answered allocation requests, answered price requests, returns awaiting
      her confirmation, and payments the admin recorded. Unread count on the bell; rows
      deep-link to the right page. Read-state is a `lastSeen` timestamp in
      `localStorage` — **no schema change**, and unread-ness is per-device anyway.
- [x] **Standalone sell grid deleted** — the home list is the only product picker.
      `/seller/sell` without `?product=` now shows a short "pick from home" card instead
      of a second grid. "Yana sotish" returns home rather than re-opening a picker.
- [x] **Success screen no longer auto-navigates** — the 10s undo runs its full life and
      then reads "Tuzatish uchun «Sotuvlarim» ga kiring". She is never bounced away.
- [x] **Two steps, not three** — step dots now show 2. Price mode defaults to the
      discount when the product has one (logic moved off the deleted `pickProduct`).
- [x] **Sale editing unified on Sotuvlarim** — the home Tuzatish modal's *sale-editing
      half is gone* (~3.9k chars removed), replaced by a link across to the single sale
      editor. One sale list, one sale editor.
- [x] **Stock-detail sheet** — tapping the card **body** opens it; the **button** sells.
      Two clearly different targets. The sheet holds the per-unit `SoldProgress` detail,
      "Boshqacha son oldim" (the one approval-gated action, correctly reframed as
      *stock*, not a sale edit), expiry, transfer, Telegram post, video.
- [x] **One stock signal on the card** — the per-unit pills moved into the sheet; the
      card keeps only the corner badge.
- [x] **Money strip** — the 2×2 cards became a compact 4-cell strip. The star metric is
      already in the header, so this is a secondary summary that no longer competes with
      the Sotildi buttons.
- [x] **G2 finished on `seller/index.tsx`** — expiry save and both request flows now
      update local state instead of reloading the page.
- [ ] **G4 symmetric trust + audit rows; hard delete → "Bekor qilingan"** 🔒
      **Blocked: needs SQL.** Requires `sales.cancelled_at` + `cancel_reason` and a
      `sale_edits` audit table before the UI can stop hard-deleting and let her edit her
      own price without approval. Not covered by D1–D6 — needs its own migration.

**Still true after this phase:** requests reachable in 1 tap via 🔔 ✅; exactly one sale
list and one sale editor ✅; selling is 2 taps from a card ✅; **nothing is hard-deleted
❌ — still outstanding until G4's SQL exists.**

---

## Phase 4 — Admin Stock Hub 🔒 (needs D1, D2)

- [ ] Merge Products + Partiyalar + Taqsimlash into one lifecycle screen
- [ ] `[+ Partiya]` (Buyurtma/Yo'lda) and one-tap `[Keldi]`
- [ ] Distribute input → pre-filled stepper with a live `+3 / −1` delta
- [ ] **G5** `📢 post` explicit with preview + confirm; **stop the silent discount post**
- [ ] Add discontinue + archive

> 🔴 **G5 is still outstanding and it is outward-facing.** Saving a product with a new
> or lowered discount *still* auto-posts to the public Telegram channel with no
> confirmation (`admin/products.tsx`, `announce-discount`). Phase 4 fixes it — but if
> you want it stopped sooner, it's a small standalone change.

---

## Phase 5 — Admin regroup + money truth 🔒 (needs D6)

- [ ] Nav → 5 grouped areas; Giveaways into Pul
- [ ] Merge dashboard + stats into Boshqaruv (every number shown once)
- [ ] Flip stock to derived; retire drift; correct `invested`/`worth`

---

## Phase 6 — Polish ⬜

- [ ] Admin offline tolerance
- [ ] Arrival waitlist, if the Telegram channel proves insufficient
- [ ] `Keldi ✅` 72h "just arrived" flourish

---

## Open items carried from `ux-walkthrough.md` §7

| # | Item | Where it gets fixed |
|---|---|---|
| 9 | Free sale delete vs approval-gated price edit | Phase 3 (G4) |
| 10 | Discount auto-posts to Telegram | Phase 4 (G5) |
| 11 | Distribute replace-vs-add ambiguity | Phase 4 |
| 12 | Four stock signals on one card | Phase 2 |
| 13 | `remaining = 0` means five things | Phase 2 (D4) |
| 14 | `invested`/`worth` drift upward forever | Phase 5 (D6) |
| 17 | No product deletion or archival | Phase 4 |
| 19 | Admin app has no offline handling | Phase 6 |
