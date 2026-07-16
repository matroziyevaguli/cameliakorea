# Seller Page (`/seller`) — Analysis & Plan

> Working doc for fixing and improving the seller home page.
> Last analyzed: after the login-dropdown change. DB confirmed live, data present.

---

## 1. What this page is supposed to show

File: `src/pages/seller/index.tsx` (component `SellerHome`)

| Section | What it shows | Data source (view) |
|---|---|---|
| Header greeting | "Salom, {name}! 👋" + "Bu oy foydangiz: X so'm" | `profiles` + `v_my_monthly` (current month) |
| Money box (2 cards) | "Topshirilishi kerak" / "Topshirilgan" | `v_my_summary` |
| Oylik foyda (bar chart) | Monthly profit by month | `v_my_monthly` |
| Product cards | Photo gallery, price, description, had/sold/remaining, Sotildi + Post + Video buttons | `v_catalog` (primary) or `v_inventory` (fallback) |

---

## 2. Confirmed facts (from DB diagnostics)

- ✅ DB is **live**, data exists: 16 products, 25 allocations, 20 sales.
- ✅ All 3 sellers are **correctly linked** to auth accounts:
  - GULSHAN → `gulshan@sellers.local`
  - ADOLAT → `adolat@sellers.local`
  - SAIDA → `saida@sellers.local`
- ✅ `v_inventory`, `v_sales_enriched`, `v_seller_balances` are healthy and have data.
- ⚠️ `v_catalog` has **drifted**: its columns are `id, name, …, total_qty, gallery`
  — it has **NO `product_id`** and lists **all products** (not per-seller allocated).
- ❓ `v_my_summary`, `v_my_monthly`, `v_my_inventory`, `v_my_sales` return 0 rows to the
  service role (expected — they filter by `my_profile_id()` = `auth.uid()`). Their
  behaviour for a **logged-in seller** is unverified from the outside.

---

## ✅ RESOLVED (root cause found + fixed in code)

Tested by logging in as a **real seller** (GULSHAN) and running the exact page queries:

| Source | Result for a seller |
|---|---|
| `v_my_inventory` | ✅ 10 rows (product_id, product_name, had, sold, remaining) |
| `v_my_summary` / `v_my_monthly` / `v_my_sales` | ✅ work |
| `v_catalog` | ✅ readable (definer view) — has prices, images, gallery; keyed by `id` |
| `v_inventory` (old fallback) | ❌ **0 rows for sellers** |
| `products` table (direct) | ❌ **0 rows for sellers** — RLS drifted to block them |

**Root cause:** the seller page loaded products via `v_catalog`(missing `product_id`→errors)
then fell back to `v_inventory`, which returns **0 rows to sellers**. Both paths empty →
no products → seller couldn't record sales. The `products` table also blocks sellers now.

**Fix applied (code, `src/pages/seller/index.tsx` + `sell.tsx`):**
- Product list now from **`v_my_inventory`** (RLS-safe, confirmed 10 rows).
- Prices/images/description/link/gallery from **`v_catalog`** (keyed by `id`), which
  sellers can read. No dependency on the blocked `products` table.
- Verified: 10 products now build with correct prices (200000, 220000, …).

**Still recommended (SQL, optional cleanup):** restore the products read policy so the
table isn't silently blocking sellers:
```sql
drop policy if exists products_select on public.products;
create policy products_select on public.products for select using ( auth.uid() is not null );
```

---

## 3. Root-cause analysis — why the page looks empty / stale (original notes)

### Problem A — Gallery never shows on seller cards  ★ confirmed
The page requests `v_catalog.select('product_id, …, gallery')`. Because the installed
`v_catalog` has **no `product_id` column**, that query **errors**. The code then falls
back to `v_inventory`, and the fallback **hard-codes `gallery: []`**. Result: product
cards show but **never display gallery photos**, and the whole "primary path" is dead code.

```
catalogRes.error is truthy  →  primary path skipped  →  fallback used  →  gallery = []
```

### Problem B — Money box + chart may be blank  ★ likely
The header profit, money box, and chart come **only** from `v_my_summary` and
`v_my_monthly`. If those views are missing/miscreated, `summary` is `null` (money box
hidden) and `monthly` is `[]` (chart hidden, "Bu oy foydangiz" = 0). Everything hinges
on these two views being correct AND filtered by `my_profile_id()`.

### Problem C — "Not updating" after a sale  ★ to confirm
After a seller records a sale, `sold`/`remaining` should change. Those come from the
fallback `v_inventory`, which **is** live — so they should update on refresh. If they
don't, the cause is browser/SSR caching or the seller looking at a stale tab, not data.

---

## 4. The fix plan (in priority order)

- [ ] **Step 1 — Fix `v_catalog`** so it has `product_id` and is per-seller.
      Run `docs/fix-views.md` § 1 in Supabase SQL Editor. This alone makes the primary
      path work again and brings back the gallery.

- [ ] **Step 2 — Verify the `v_my_*` views exist and are correct.**
      Re-run the definitions in `docs/new-views.md` (v_my_summary, v_my_monthly,
      v_my_inventory, v_my_sales). Safe to re-run.

- [ ] **Step 3 — Make the page resilient (code).**
      Even with the views fixed, the page should degrade gracefully:
      - Money box: if `summary` is null, show a friendly "Ma'lumot yo'q" instead of hiding.
      - Products: keep the `v_inventory` fallback but also fetch gallery from
        `product_images` in the fallback (so photos show even if `v_catalog` is stale).

- [ ] **Step 4 — Verify end-to-end as a real seller.**
      Log in as `gulshan@sellers.local`, confirm: greeting, money box, chart, product
      cards with photos, record a sale, see sold/remaining update on refresh.

---

## 5. Exact SQL needed (copy into Supabase SQL Editor)

See these existing docs — no need to rewrite:
- `docs/fix-views.md` § 1 → correct `v_catalog` (**do this first**)
- `docs/new-views.md` → `v_my_summary`, `v_my_monthly`, `v_my_inventory`, `v_my_sales`
- `docs/gallery-setup.md` → `product_images` table (if not already created)

---

## 6. Verification checklist (after running SQL)

- [ ] `node scripts/diag.mjs` shows `v_catalog` cols include **`product_id`** and **`gallery`**
- [ ] Log in as a seller → header shows greeting + this-month profit
- [ ] Money box shows two numbers (not blank)
- [ ] Chart renders at least the current month
- [ ] Product cards show photos (if any uploaded) + correct had/sold/remaining
- [ ] Record a sale → refresh → sold +1, remaining −1
- [ ] "Post" button sends to Telegram; "Videoni ko'rish" opens link when present

---

## 7. Ideas / future improvements  _(fill in your own)_

- [ ] Pull-to-refresh or a manual refresh button on the seller home
- [ ] Show low-stock warning more prominently
- [ ] _..._
- [ ] _..._

---

## 8. Notes / open questions

- Should the money box update live after admin logs a payment, or is refresh OK?
- Do we want the gallery on the card, or a tap-to-open full-screen viewer?
- _..._
