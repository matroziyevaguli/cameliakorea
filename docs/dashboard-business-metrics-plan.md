# Admin dashboard — "Biznes holati" metrics — plan

Add a section to `/admin` showing the big-picture business progress: what you put in, what it's
worth, how much has sold, your profit, expected profit, and giveaways — with a progress bar.

## Definitions (exact formulas)
Let **effective price** = `discount_price ?? retail_price` (i.e. discounted price counts when set).

| Metric | Formula | Meaning |
|---|---|---|
| **Qo'yilgan pul** (invested) | Σ `cost × total_qty` | what you paid wholesale for ALL stock |
| **Umumiy qiymati** (total worth) | Σ `effective × total_qty` | total sellable value of all stock (discounts applied) |
| **Sotildi** (sold so far) | Σ `sales.revenue` (all sales) | money actually earned so far |
| **Mening foydam** (profit so far) | Σ `my_profit` (all sales) | your real earned profit to date |
| **Kutilayotgan foyda** (expected) | `worth − invested` = Σ `(effective − cost) × total_qty` | gross profit if EVERYTHING sells (before seller commission) |
| **Sovg'alar** (giveaways) | units = Σ `qty` where reason ∈ (`giveaway`,`gift`); value = Σ `cost × qty` | units given away free + their cost (marketing spend) |
| **Progress %** | `sold ÷ worth` | how far through selling the whole inventory |

Notes:
- **Discounts**: worth & expected profit use the discounted price when a product has one, per your ask.
- **Honesty flags**: "Kutilayotgan foyda" is *gross* (you keep ~60%, sellers ~40% via commission);
  "Mening foydam" is your actual net share so far. Both shown so it's clear.
- Giveaways/damaged units never generate revenue, so progress can't reach 100% if any are given away.

## Data (admin server client — RLS allows all of these; no new SQL)
- `products` → `cost, total_qty, retail_price, discount_price`  (invested, worth, expected)
- `stock_adjustments` → `reason, qty, product_id`  (giveaways; join to product cost)
- already fetched: all `v_sales_enriched` rows → `revenue, my_profit, qty` (sold, profit)

## UX (add to the top of `/admin`, above the existing KPI cards)
1. **Progress card (hero)** — full width:
   - "Sotildi: **{sold}** / {worth} so'm" + a filled progress bar + "**{pct}%** sotildi".
   - Reads in 2 seconds; the motivating "how far am I" view.
2. **Metric grid (2×2 on phone, 4-up on desktop)**:
   - **Qo'yilgan pul** (invested) — ink
   - **Umumiy qiymati** (worth) — ink
   - **Kutilayotgan foyda** (expected, green) — sub-label "agar hammasi sotilsa"
   - **Sovg'alar** — "{units} dona" + sub-label "{value} so'm (xarajat)"
3. Keep the existing KPI cards (Umumiy savdo, Mening foydam, Yig'ilishi kerak, Sotilgan dona),
   the top-products chart, and recent sales — unchanged, below the new section.

Design: reuse the app's tokens/patterns (cards `bg-surface rounded-2xl shadow-card`, rose→peach
gradient for the hero/progress, `formatUZS`). Nothing touches the money views or seller side.
