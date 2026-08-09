# Ordering + survey — build log

Implements `docs/ordering-and-survey-plan.md` (v2). One entry per phase step.

---

## Phase 0 — Foundations ✅  2026-08-09

**DB (owner runs):** `docs/ordering-phase0-setup.md`
- `profiles`: + `city`, `card_number`, `card_holder`.
- new `product_tags(product_id, tag_type, tag_value)` + index + RLS (public read, admin write).
- Verify + rollback blocks included. **Admin UI below stays inert until this SQL is run.**

**Code**
- `src/consts/skincare.ts` — skin types + concerns taxonomy (Uzbek labels), shared by admin + survey.
- `src/consts/geo.ts` — cities (Namangan/Andijon/Farg'ona/Boshqa).
- **0a** `src/pages/admin/sellers.tsx` — edit form gains **Shahar / Karta raqami / Karta egasi**;
  collapsed row shows a city chip + "Karta bor/yo'q". SSR + reconcile select the new columns.
- **0b** `src/pages/admin/products.tsx` — product form gains **Teri turi** + **Muammolar** chip
  multiselects; tags load on edit and save via delete-all-then-insert into `product_tags`.

**Verify:** `tsc` clean · `yarn build` compiles (`/admin/sellers`, `/admin/products`).
Pending owner action: run the Phase 0 SQL, then set seller cards/cities and tag the catalog.

### Coverage note (from plan §0b)
After tagging, run the "buyable but untagged" query in the setup doc — those products are invisible
to the survey. Decide the fallback (plan §1 Phase 1) before Phase 1 ships.

### Addendum — DB confirmed applied + `category` column  2026-08-09
Owner ran the Phase 0 SQL. Verified live: `profiles.city/card_number/card_holder` present,
`product_tags` exists (0 rows so far), RLS policies in place. A bonus **`products.category`**
(nullable free-text + index) was also added out of band — now wired into the product form as a
suggestion-backed input (`admin/products.tsx`), saved on create/edit. All categories null so far.

**Still outstanding (owner content work):** set seller cards/cities, and tag + categorise the 32
products. Survey (Phase 1) is only meaningful once some products carry skin_type/concern tags.

---

## Next: Phase 1 — Survey (`/tavsiya`), rule-based matching. Needs a few tagged products to test against.

---

## Phase 0.5 — Catalog tagged  2026-08-09

Owner approved the tag/category proposal (`docs/ordering-product-tags-proposal.md`) with 3 calls:
Dalba = Waterfull **mist** (face), Glutathione = **included** in survey (brightening add-on),
Lola Nudy Spray = **body** (excluded).

`scripts/apply-product-tags.mjs --commit` (validates a 1:1 name→rule match, aborts if ambiguous):
- **32/32** products categorised (no nulls); **23** carry skin_type ⇒ in the survey, 9 are other
  departments (dental×3, foot×2, deodorant, hair, body spray, — category only).
- `product_tags`: **127 rows** (78 skin_type + 49 concern). Re-runnable (replaces each product's tags).

Coverage is solid — every skin type + concern maps to multiple products, so Phase 1 has real data.

---

## Phase 1 — Survey (`/tavsiya`) ✅  2026-08-09

Public, rule-based skincare quiz → recommendations. No auth, no writes.
- `src/pages/tavsiya.tsx`: 2-step quiz (skin type → concerns, ≤3), then ranked results.
  SSR pulls `v_shop` (buyable/state/remaining) + `product_tags` (anon read) and merges.
- **Ranking (plan §1):** tier 0 = skin match AND ≥1 concern (by # matched), tier 1 = skin-only,
  tier 2 = rest; in-stock and discounted rise within a tier; top 8 shown. Fallback header
  "Sizga yoqishi mumkin" + soft note when exact matches < 3. Out-of-stock ranked last, greyed.
- Result cards show state badge (shared availability lib) + a "✓ … uchun" why-line, linking to
  the product page. (Add-to-cart lands in Phase 2.)
- Entry point: hero button on `/` — "Teringizga mos mahsulotni toping".

**Verify:** simulated dry + dryness/dullness → 14 exact matches, best (Glow Oil Mist, Snail Cream)
ranked first. `tsc` clean · `yarn build` ok (`/tavsiya`).

---

## Phase 2 — Cart + checkout + orders ✅ (code)  2026-08-09

**DB (owner runs):** `docs/ordering-phase2-setup.md` — `customers`, `orders`, `order_items`,
updated_at trigger, admin RLS, private `order-receipts` bucket. **Also:** BotFather `/setdomain`
→ site domain, and env `NEXT_PUBLIC_TELEGRAM_BOT` (bot @username). Inert until done.

**Auth (Telegram, decoupled from admin/seller Supabase Auth)**
- `lib/customerAuth.ts` — verify Telegram widget hash (bot token), opaque `session_token` in an
  httpOnly cookie, `getCustomer(req)` via service role.
- `api/auth/telegram` (verify→upsert customer→session), `api/auth/logout`, `api/auth/me`.
- `components/TelegramLogin.tsx` — the widget.

**Cart** `lib/cart.ts` (localStorage + window-event sync) · `components/CartFab.tsx` (floating
badge → /savat, on storefront/product/survey) · "Savatga qo'shish" on the product page.

**Checkout** `pages/savat.tsx` — cart editor + login gate + city/address/contact form.
`api/orders/create` re-validates every line against `v_shop` (stock+price), resolves the
city's seller (else Gulshan), writes `orders` + `order_items`, returns the seller's card.

**Payment + status** `api/orders/receipt` (compressed screenshot → private bucket →
awaiting_confirmation) · `pages/buyurtma/[id].tsx` — SSR owner-checked status page showing the
card + amount, receipt upload, and re-upload on reject.

**Verify:** `tsc` clean · `yarn build` compiles all routes (/savat, /buyurtma/[id], 5 API routes).
Order confirmation → seller sale (stock integration) is **Phase 3** (admin Orders page).

## Next: Phase 3 — /admin/orders (view receipt, confirm→seller sale, assign, deliver) + notifications.

---

## Phase 3 — Admin orders + confirm→sale ✅ (code)  2026-08-09

**DB (owner runs):** `docs/ordering-phase3-setup.md` — atomic `confirm_order(uuid)` (SECURITY
DEFINER): checks v_product_availability stock, bumps the assigned seller's allocation to cover
sold+qty, inserts `sales` rows, sets status=confirmed — all-or-nothing. Grant to service_role.

**Code**
- `api/admin/order-action` (admin-verified): `confirm` → confirm_order RPC; `reject` →
  awaiting_payment_retry + reason; `assign` → seller; `delivering`/`delivered`/`cancelled`.
- `pages/admin/orders.tsx`: tabbed list (Tasdiqlash / To'lov / Jarayonda / Yakunlangan),
  customer+delivery+items, seller assign dropdown, signed-URL receipt thumbnail, confirm/reject/
  deliver actions. SSR uses the service role (reads + signs receipts).
- `lib/telegram.ts` `notifyOwner` — owner pinged on receipt upload + on confirm.
- AdminNav gains **Buyurtmalar**.

**Verify:** `tsc` clean · `yarn build` ok (/admin/orders, /api/admin/order-action).
Confirm turns an online order into the assigned seller's sale, so remaining/balances stay
consistent (reuse `scripts/audit-stock.mjs` to check after a live confirm).

## Remaining owner actions to go live end-to-end
1. Run Phase 2 SQL (`ordering-phase2-setup.md`) + Phase 3 SQL (`ordering-phase3-setup.md`).
2. BotFather `/setdomain` + env `NEXT_PUBLIC_TELEGRAM_BOT`.
3. Set seller cards/cities in /admin/sellers.

## Next (optional): Phase 4 — seller order view, email notifications, post-confirm reassignment reversal.

---

## UX #1 — Header logged-in state ✅  2026-08-09

Per `docs/user-experience-plan.md` §1. When a customer is logged in, the header no longer shows
"Kirish" — it shows their **name** (opening a compact account menu: Mening buyurtmalarim · Chiqish,
+ a small "Admin / Sotuvchi sifatida kirish" link). A **cart icon with count badge** (`HeaderCart`)
is now always in the header; the landing-page floating cart is removed as redundant. Logged-out
header is unchanged (Kirish → Telegram login + staff options).
