# Camelia — Online Ordering + Skincare Survey — Plan v2 (reviewed)

> This is a review pass on the original planning doc. Same scope, same locked
> decisions — this version tightens the data model, calls out the edge cases
> that will bite in production, and adds a page-by-page UI spec so Phase 1–3
> can be built without re-litigating layout decisions mid-sprint.

---

## 0. What changed vs. v1

- Added `updated_at` + indexes to new tables (v1 had none — `admin/orders`
  filtering by status will be slow without them at scale, and you have no
  audit trail for status changes).
- Flagged a **race condition** in the stock re-validation flow (checkout vs.
  confirm) and proposed the fix already hinted at in "Open questions #3".
- Added **cart-merge-on-login** handling (v1's cart is localStorage-only,
  which breaks the moment a customer logs in from a second device).
- Added a **rejection → resubmission** loop for receipts (v1 only had
  Confirmed/Rejected as a dead end).
- Added full page-by-page layout specs (§4).
- Reordered Phase 0 slightly — sellers need cards *before* tags matter, but
  tags need to exist before the survey is testable, so Phase 0 is split into
  0a/0b so you can parallelize.
- Answered the open questions with a recommendation instead of leaving them
  open (§6).

---

## 1. Phase-by-phase analysis

### Phase 0 — Foundations
**Risk:** "schema + admin forms" as one phase is really two independent
pieces of work (seller cards vs. product tags) that don't block each other.
Splitting lets you verify the survey's data (Phase 1) while checkout
(Phase 2) is still being wired up.

- **0a — Seller payout data:** `profiles.city/card_number/card_holder` +
  `/admin/sellers` form. Verify: every active seller has a card before
  Phase 2 ships, or checkout will show a blank/undefined card for that city.
- **0b — Product tagging:** `product_tags` + multiselect in
  `/admin/products`. Verify: **tag coverage** — run a query for products
  with `buyable = true` and zero tags; those are invisible to the survey.
  Decide now whether untagged-but-buyable products should be excluded from
  survey results or shown in a generic "barcha mahsulotlar" fallback bucket.

**Gap in v1:** no plan for *who* tags the existing catalog. If there are 50+
products already live, tagging is a one-time data-entry task — budget time
for it explicitly, it's not "foundation code," it's content work.

### Phase 1 — Survey
**Risk:** the matching rule ("shares ≥1 concern AND skin type matches or is
universal") can return **zero results** for narrow combinations (e.g.
sensitive skin + pigmentation, if nothing's tagged that way yet). v1 doesn't
say what the empty state does.

- **Fix:** define a fallback tier — if strict match returns < 3 products,
  relax to skin-type-only match, then to "best sellers / discount" as a last
  resort, and label the section differently ("mos mahsulotlar yo'q, lekin
  bular ham yaxshi tanlov" — no exact match, but these are good picks) so it
  doesn't look broken.
- Out-of-stock items should still appear (per v1) but sorted **after**
  in-stock ones, not just visually greyed — ranking, not just styling.

### Phase 2 — Cart + checkout + auth
This is the highest-risk phase. Three gaps in v1:

1. **Cart merge on login.** Cart lives in localStorage pre-login (correct,
   keeps survey/browsing anonymous). But once a customer logs in on the
   `/savat` page, if they've ordered before on another device, do carts
   merge? Recommendation: **don't merge** — localStorage cart always wins,
   login only attaches identity to the order at creation time. Simple, no
   surprise merges, matches a single-session shopping mental model.
2. **Stock re-validation is checked "at checkout" but the doc doesn't say
   where that boundary is.** Recommendation: re-validate against `v_shop`
   in two places — (a) when `/savat` loads (so stale prices/stock show
   immediately), and (b) as the last write inside the "create order"
   transaction (reject the whole order if any line fails, show which item).
3. **Receipt rejection is a dead end.** If admin rejects (wrong amount,
   unreadable screenshot), v1 has no path back to the customer except manual
   Telegram contact. Add: rejected orders return to
   `awaiting_payment_retry` (or just back to `pending_payment`) with a
   `rejection_reason` column, and `/buyurtma/[id]` shows a "qayta yuklash"
   (re-upload) button. This is a small addition now, painful to retrofit
   later since it touches status enum + admin UI + customer UI together.

### Phase 3 — Admin Orders + stock integration
v1's §4.4 correctly identifies the allocation dependency
(`check_alloc_within_stock`) as the sharp edge. Two additions:

- **Confirm must be atomic.** Steps 1–4 in §4.4 need to run in a single DB
  transaction (or a single Postgres function called via RPC) — if the
  allocation bump succeeds but the `sales` insert fails, you've silently
  over-allocated a seller with no sale to show for it. Don't do this as
  sequential client-side calls.
- **Race between two orders for the same last unit.** If two customers both
  upload receipts for the last unit of a product, admin will try to confirm
  both. Recommendation: the re-check in step 1 of §4.4 must lock the row
  (`select ... for update` on the product/allocation) so the second confirm
  fails cleanly with "stock mavjud emas" instead of both succeeding and
  going negative.

### Phase 4 — Seller view, email, polish
No structural issues. One addition: **seller reassignment mid-flow.** If
admin reassigns an order to a different seller *after* confirm (e.g. seller
1 is out of stock), the original seller's allocation/sale needs to be
reversed and re-created for seller 2 — same atomicity requirement as above.
Worth a one-line note in the admin UI spec even if the reversal logic ships
in Phase 4.

---

## 2. Data model refinements

Additions on top of v1's schema (same file, same `docs/*-setup.md` delivery
pattern):

```sql
-- audit / performance additions

alter table public.orders
  add column if not exists rejection_reason text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_assigned_seller on public.orders(assigned_seller_id);
create index if not exists idx_orders_customer on public.orders(customer_id);
create index if not exists idx_product_tags_lookup on public.product_tags(tag_type, tag_value);

-- keep updated_at fresh (reuse whatever trigger pattern total-qty-from-batches uses)
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_touch on public.orders;
create trigger trg_orders_touch
  before update on public.orders
  for each row execute function public.touch_updated_at();
```

- `orders.status` enum: add `awaiting_payment_retry` between `rejected` and
  `pending_payment` in the check constraint, per Phase 2 fix above.
- Consider a lightweight `order_status_history` table (order_id, from,
  to, actor, note, created_at) — cheap to add now, saves a support
  headache later when a customer disputes what happened to their order.
  Optional, not blocking.

---

## 3. Edge-case checklist (carry into QA)

| Case | Handling |
|---|---|
| Product goes out of stock between survey and add-to-cart | `isBuyable` gate on the button, same as catalog today |
| Product goes out of stock between add-to-cart and checkout | Re-validate on `/savat` load; block checkout for that line |
| Price changes between add-to-cart and checkout | Re-validate on `/savat` load; show "narx yangilandi" and updated total before confirm |
| Customer uploads wrong/blurry receipt | Rejection loop (§1 Phase 2) |
| Two orders race for last unit at confirm time | Row lock in confirm transaction (§1 Phase 3) |
| Seller reassigned after confirm | Reverse + recreate allocation/sale (§1 Phase 4) |
| Customer has no city match (typo, rural area) | "boshqa" bucket → Gulshan, always resolvable |
| Untagged buyable product | Fallback bucket in survey results, not silently excluded |
| Cart on two devices, same customer | No merge — localStorage wins per device (§1 Phase 2) |
| Order abandoned at `pending_payment` forever | Optional: cron/manual sweep to auto-cancel after N days (not in v1, worth a backlog item) |

---

## 4. Page-by-page UI spec

Layout notes assume the existing storefront's visual language (catalog +
product page) — this just defines structure/content per screen, not final
visual design.

### 4.1 `/tavsiya` — Survey

```
[ Header: shop nav, same as catalog ]

[ Progress bar: savol 1/4 ]

  Question card (centered, single focus per screen)
  ── "Sizning teri turingiz qanday?"
     ○ Normal   ○ Quruq   ○ Yog'li   ○ Aralash   ○ Sezgir
  [ Orqaga ]                              [ Keyingi → ]

...repeat for concerns (multi-select, max 3, checkboxes), optional
age band / budget...

[ Final screen: "Natijalar" ]
  Grid of product cards (reuse catalog card component), each with:
    - image, name, price
    - one-line "nega mos" tag summary (e.g. "Yog'li teri • Akne uchun")
    - Savatchaga button (disabled + "tugagan" if not isBuyable)
  If < 3 exact matches: section header changes to
    "Aniq mos kelmadi, lekin bular ham yaxshi tanlov" + relaxed results
  [ Qayta boshlash ] link at bottom to retake
```

State notes: no login required anywhere on this page. Answers held in
component state only (not persisted) unless you want a "retake" deep link,
which isn't needed for v1.

### 4.2 `/savat` — Cart + Checkout

Single page, step-based (not separate routes, keeps back-button simple):

```
[ Header ]

STEP A — Savat (always visible if cart non-empty)
  List of line items: image, name, qty stepper, unit price, line total, remove
  [ inline warning if re-validation found a stock/price change on this line ]
  Subtotal: ###,### so'm
  (no delivery fee line — per decision §6.2)
  [ Buyurtma berish → ] (disabled if cart empty or any line invalid)

STEP B — Kirish (only if not logged in)
  [ Telegram bilan kirish ] (primary button, widget)
  ── yoki ──
  [ Telefon raqam bilan kirish ] (secondary, shows OTP flow inline)
  (email input, optional, small/collapsed: "Email (ixtiyoriy, bildirishnoma uchun)")

STEP C — Yetkazib berish
  Shahar: [ select: Namangan / Andijon / Farg'ona / Boshqa ]
  Manzil: [ textarea ]
  Ism: [ prefilled from customer if exists ]
  Telefon: [ prefilled ]
  → on city select, resolve seller silently (no UI needed, just used in step D)

STEP D — To'lov
  "To'lov: <seller name>ning kartasiga"
  Card number (large, tap-to-copy) · Card holder name
  Summasi: ###,### so'm
  [ Chek yuklash ] (image upload, reuse admin image.ts pattern, compressed)
  [ Buyurtmani tasdiqlash ] → creates order, uploads receipt, sets
    awaiting_confirmation, redirects to /buyurtma/[id]

Sticky bottom bar (mobile): running subtotal + current step's primary CTA
```

### 4.3 `/buyurtma/[id]` — Order status

```
[ Header ]

Status stepper (horizontal, 4 nodes):
  To'lov kutilmoqda → Tasdiqlanmoqda → Tasdiqlangan → Yetkazilmoqda → Yetkazildi
  (current node highlighted; cancelled/rejected shown as a red banner instead
   of a stepper node)

If status = rejected / awaiting_payment_retry:
  Red/amber banner: rejection_reason text
  [ Chekni qayta yuklash ] button → re-opens upload, same order id

Order summary card: items, qty, subtotal, city/address, assigned seller name
(no card number shown again once paid — avoid repeat exposure)

Contact fallback: "Savollaringiz bo'lsa, Telegram orqali yozing" + deep link
```

### 4.4 Catalog / product page — buy buttons

No new page, just an addition next to the existing Telegram deep-link
button on `index.tsx` and `product/[id].tsx`:

```
[ Savatchaga qo'shish ]   [ Telegram orqali buyurtma ]
     (primary)                  (secondary, existing)
```
Both respect `isBuyable`; if not buyable, both are replaced by a single
disabled "Tugagan" state, matching current catalog behavior.

### 4.5 `/admin/orders`

```
[ Admin nav ]

Filter bar: [ Status: hammasi ▾ ] [ Sotuvchi: hammasi ▾ ] [ Shahar ▾ ] [ Qidiruv ]

Table (or card list on mobile):
  Order # | Customer | City | Seller | Subtotal | Status badge | Created | →

Row click → detail panel/drawer:
  - Items list (name, qty, price)
  - Customer contact (name, phone)
  - Delivery address
  - Receipt image (click to zoom, signed URL)
  - Assigned seller [ dropdown to reassign ]
  - Actions: [ Tasdiqlash ] [ Rad etish + reason field ] [ Yetkazilmoqda ] [ Yetkazildi ]
  - Status history (if order_status_history table added)

Confirm action shows a blocking spinner/toast — this call can fail on
insufficient stock; surface that error inline, don't let it fail silently.
```

### 4.6 `/admin/products` (addition to existing form)

```
[ ...existing product fields... ]

Teri turi:   [ multiselect chips: Normal / Quruq / Yog'li / Aralash / Sezgir ]
Muammolar:   [ multiselect chips: Akne / Quruqlik / Yog'lilik / Ajin / Dog'lar
                                   / Qizarish / Teshiklar / Xiralik ]
```
Chip-multiselect, not a dropdown — tag sets are small and benefit from being
all visible at once during data entry (this matters for the one-time
tagging backlog mentioned in §1 Phase 0).

### 4.7 `/admin/sellers` (addition to existing form)

```
[ ...existing seller fields... ]

Shahar (standart):  [ select ]
Karta raqami:        [ text, formatted 4-4-4-4 ]
Karta egasi:          [ text ]
```

### 4.8 `/seller/orders` (Phase 4)

```
[ Seller nav ]

List of orders where assigned_seller_id = me, status in (confirmed, delivering)
  Order # | Customer | Address | Items | Status
  [ Yetkazilmoqda ] / [ Yetkazildi ] action buttons
```

---

## 5. Revised phasing

| Phase | Scope | Unblocks |
|---|---|---|
| 0a | Seller cards/city + `/admin/sellers` | Phase 2 checkout can show a real card |
| 0b | Product tags + `/admin/products` (+ one-time tagging pass) | Phase 1 survey has data to match against |
| 1 | `/tavsiya` survey, fallback tiers | Marketing can start driving traffic here pre-checkout |
| 2 | Cart, auth, checkout, receipt upload, rejection loop | Real orders start flowing in |
| 3 | `/admin/orders`, atomic confirm+allocate+sale, row locking | Orders become real inventory/balance movements |
| 4 | Seller view, reassignment reversal, email, abandoned-order sweep | Full loop closed |

0a/0b can run in parallel. Everything else stays sequential as in v1.

---

## 6. Open questions — recommendations

1. **Phone OTP needs an SMS provider.** Recommend: launch **Telegram-login
   only** for v1 of Phase 2. Add phone OTP in Phase 4 once you've seen real
   demand and can justify the SMS cost — most of your customers are almost
   certainly already reachable via Telegram if that's your current sales
   channel.
2. **No delivery fee** — confirmed, reflected in §4.2 (no delivery line in
   the checkout UI).
3. **Insufficient warehouse stock at confirm** — confirmed approach: block
   with a clear message, admin adds a partiya or reassigns. Recommend the
   error message name the exact shortfall ("12 dona kerak, omborda 5 dona")
   so admin doesn't have to go dig for it.
4. **Cancellations/refunds** — recommend a simple rule: cancelling a
   `confirmed`+ order reverses the `sales` row and the allocation bump
   (mirror of §4.4 steps 2–3 in reverse), sets status `cancelled`, and
   requires a mandatory note field (money already moved to the seller's
   card, so the note is the only record of what happened for reconciliation
   — this becomes important at balance-review time).
5. **Guest express order** — keep as decided: Telegram deep-link stays as
   the no-login fallback, no separate guest checkout built.
6. **Multiple sellers / split delivery** — keep single-seller-per-order for
   v1. If this becomes a real need later, it's a bigger change (splitting
   an order into sub-orders per seller) — not worth designing for
   speculatively now.

---

## 7. Testing & verification (additions to v1 §10)

- `audit-stock.mjs` run after Phase 3, **plus** a targeted test: fire two
  concurrent confirms for orders on the last unit of a product, assert only
  one succeeds and stock never goes negative (validates the row-lock fix).
- Survey matcher unit tests should include the **zero-match case**
  explicitly, asserting the fallback tier fires rather than an empty page.
- Manual E2E should also cover: reject → resubmit → confirm, and
  reassign-after-confirm → balances correct for both sellers.