# Camelia Korea — Inventory Intelligence Plan

> Turns inventory from "how many are left?" into "**what should I do about it?**" — batch &
> expiry tracking, FIFO costing, expiration-driven promotions, low-stock & slow-mover alerts,
> and data-driven purchase suggestions. Goal: **minimize expired stock, protect margin, and
> automate the "what to buy / what to promote" decisions.**
>
> This adapts a fuller "Inventory Intelligence" spec to Camelia's **real schema and scale**
> (~16 products, 3 sellers, one main import channel today). It supersedes and expands
> [Module 3 of the growth plan](./camelia-growth-plan.md#3-restock), and connects to the
> promotions engine (Module 2) and the Instagram/Telegram posting (Module 1). Read the
> [master plan](./camelia-master-plan.md) first for the money model and golden rules.
>
> **Planning only — no code yet.** _Written: 2026-07-16._

---

## 0. Honest assessment (is this worth building?)

**Yes — and expiry tracking is the highest-value single feature in any Camelia plan**, because
in skincare an expired unit is a 100% loss of a product you already paid for. But three
truths shape *how* to build it:

1. **Batch tracking is a structural change, not a bolt-on.** Today `products` holds one
   `cost` and one `total_qty`. Batches move cost, quantity, and expiry onto each *purchase*,
   and FIFO makes a sale's profit depend on which batch it drew from. That touches the money
   views. It's the right model — it just needs a **migration path** (§2), done once, carefully.
2. **"AI" should start as transparent rules, not black-box confidence scores.** With a few
   months of history and ~16 SKUs, real forecasting/seasonality isn't statistically honest
   yet. Ship **clear heuristics** (velocity, days-of-cover, months-to-expiry) labeled as
   *estimates*, and add ML forecasting later once there's data. Never show a fake "92%
   confidence." (§8)
3. **Right-size to today's scale.** Suppliers/purchase-orders and per-seller batch allocation
   add real overhead. Keep them **optional/lightweight** now (one import channel, product-level
   allocation) and turn them on when the business needs them (§3, §4).

Everything else in the spec — expiration status tiers, promotion suggestions, campaign
generation, health dashboard, low-stock & slow-mover alerts, purchase suggestions — is
**high-value and fits cleanly**. The plan below keeps all of it, sequenced by value ÷ effort.

---

## 1. What this module tracks (the intelligence)

For every product and batch, the system should know and act on:

- Which products sell **fast** vs **slow** (velocity).
- Which **batch** should sell first (FIFO).
- Which units are **near expiry** (and how near).
- What to **discount / bundle / clear**, and when.
- What to **reorder**, and **how many**.
- What deserves a **marketing push** (and auto-generate it for IG/TG).

---

## 2. 📦 Batch tracking + FIFO costing (the foundation)

### Why batches
A "batch" = one purchase of a product. Two batches of the same product can have **different
cost and different expiry**. Skincare must be sold **oldest-expiry-first (FIFO)**, and profit
must use **that batch's cost**.

### New table: `product_batches`
| Field | Meaning |
|---|---|
| `id`, `product_id` | which product |
| `batch_code` | human label, e.g. `2026-001` |
| `supplier_id?` | optional (see §3) |
| `arrival_date`, `manufacture_date?`, `expiry_date` | dates |
| `cost` | **per-unit wholesale cost of THIS batch** |
| `sell_price?` | optional per-batch price override |
| `qty_purchased`, `qty_remaining` | stock in this batch |
| `status` | `active / sold_out / expired / withdrawn` |

Example: *Beauty of Joseon Relief Sun — Batch #2026-001, arrived 2026-03-15, expires
2028-03-10, purchased 150, remaining 97.*

### How FIFO + costing works (the important reconciliation)
Today profit = `unit_price − products.cost`. With batches, **`cost` comes from the batch a
sale draws from.** Concretely:

- Business-level **remaining** for a product = `sum(qty_remaining)` across its active batches.
- When a sale is recorded, the system **assigns it to the oldest non-expired batch with
  stock** (splitting across batches if needed) and decrements that batch's `qty_remaining`.
- The sale stores which batch(es) it consumed, so **COGS = the consumed batches' costs** —
  and `margin`, the seller's 40%, and your 60% all flow from that, unchanged in spirit.

> **Keep seller allocation product-level (recommended for now).** Sellers still hold "3
> Collagen," not "3 Collagen from batch X." FIFO/costing happens at **sale time** for
> accounting; you don't need to track which seller physically holds which batch. If, later,
> different sellers hold visibly different expiry dates and it matters, you can upgrade to
> batch-level allocation — but that's overkill at today's scale.

### Migration path (do it in this order, so nothing breaks)
1. **Add `product_batches`.** For each existing product, create **one "opening" batch** from
   today's `total_qty` + `cost` (+ a best-guess expiry you can edit). Nothing else changes yet.
2. **Backfill costing view.** Point the money views at "the product's active batch cost"
   (still one batch → identical numbers to today). Verify balances are unchanged.
3. **Turn on FIFO** on new sales (assign + decrement batch). Old sales keep their recorded cost.
4. **Expiry, alerts, suggestions** read from batches from then on.

This lets you adopt batches **without a risky big-bang** — step 1–2 are invisible to the money
math, and value starts arriving at step 3–4.

---

## 3. 🏭 Suppliers & purchase orders (keep light for now)

The spec includes suppliers and POs. At one main import channel, make these **optional**:
- `suppliers` (name, lead-time-days, contact, notes) — start with a single row.
- A **purchase order** can be as light as: a `purchase_orders` header + lines that, on
  arrival, **become batches**. Until you buy from several suppliers, a PO is really just "the
  next batch," so don't over-build it.

Adopt full PO tracking when you actually juggle multiple suppliers or need supplier
performance stats (on-time %, defect %). Flagged as **later** in the rollout.

---

## 4. ⏳ Expiration management

Track `expiry_date` per batch; classify by **months remaining** (admin-configurable
thresholds — these are sensible defaults):

| Status | Months left | Action |
|---|---|---|
| 🟢 Healthy | > 12 | none |
| 🟡 Monitor | 9–12 | admin reminder only |
| 🟠 Promote | 6–9 | recommend a promotion |
| 🔴 Critical | 3–6 | high-priority promotion |
| ⚫ Clearance | < 3 | emergency clearance |

An **expiration calendar** on the dashboard shows what crosses each threshold and when.
Thresholds live in `settings` so you can tune them per product category if needed.

---

## 5. 💸 Expiration → 📢 promotion → campaign (the automation loop)

This is where inventory intelligence meets the **promotions engine** (growth-plan Module 2)
and **posting** (Module 1) — the chain that actually saves the money:

```
batch nears expiry ──► system SUGGESTS a promotion ──► you APPROVE ──►
     campaign text auto-generated ──► you pick channels ──► posted to IG / TG / site
```

- **Suggested promotions** by tier: 10% / 15% off, Buy-2-Get-1, bundle, flash sale, wholesale
  discount, clearance. The nearer the expiry, the deeper the suggested discount.
- **Campaign generator** (reuse your existing AI caption route): from an approved promotion,
  produce an **Instagram caption, Telegram post, homepage banner, story caption, hashtags,
  product link** — you review, then one-tap post to the channels you tick (✓ Telegram ✓
  Instagram ✓ Website ✓ Push). Facebook/TikTok/Email later.
- Everything is **admin-approved before publishing** — no auto-posting surprises.

> Guardrail: a clearance discount cuts margin, which cuts **both** the seller's 40% and your
> 60%. Decide who absorbs promo discounts (see growth-plan §14) — cleanest is off the shared
> margin, which needs no special math.

---

## 6. 📊 Dashboard, alerts & slow-movers

### Inventory Health Dashboard (`/admin/inventory`)
Widgets: **total inventory value**, healthy vs **at-risk** value, **products expiring soon**,
**estimated potential loss** (value of stock likely to expire unsold), **recovered revenue**
(from clearance campaigns), **inventory turnover**, **average shelf age**, **batch
distribution**, and a single **Inventory Health Score** (one number: green/amber/red). Pie
charts + trend lines.

### 🚨 Low-stock alerts
Per-product min threshold (e.g. min 10, current 6 → "Low — recommend purchase"). Surface on
the dashboard, optionally Telegram DM to you. Ties directly into purchase suggestions (§7).

### 📉 Slow-moving detection
Rules (configurable): no sale in **30 days** = slow, **60 days** = critical, stock older than
**180 days** = needs action. Each flagged product gets suggested actions: **bundle, discount,
feature on homepage, IG/TG campaign, wholesale push** — reusing the same promotion pipeline (§5).

---

## 7. 🤖 Purchase suggestions ("what & how much to buy")

Transparent formula first (proven retail math — [inFlow][r5], [ABC Supply Chain][r6]),
computed per product from your own data:

```
avg daily sales    = units sold ÷ days on sale
days of stock left = remaining ÷ avg daily sales
safety stock       = (max daily × max lead) − (avg daily × avg lead)
reorder point      = (avg daily × lead time) + safety stock
suggested qty      = (target cover days × avg daily) − on-hand − incoming
```

**Suggested Next Purchase** table on the dashboard: product · current stock · avg/day · **days
remaining** · supplier · **recommended qty** · **priority** (Critical/High/Medium/Low) ·
**reason** (plain language) · **one-click "Create Purchase Order"** (which, on arrival, becomes
a batch — §2/§3).

Inputs it *also* considers as you grow: pending **seller restock requests**, **wholesale**
& **retail price inquiries** (from the growth-plan Requests spine), and inventory at risk.

Example (labeled as an **estimate**, not a fake confidence score):
> *"Stock lasts ~18 days · avg demand up ~22% this month · Korea lead time ~14 days →
> **suggest buying ~80 units.**"*

---

## 8. 📈 Demand forecasting & smart insights — the honest maturity ladder

Don't ship black-box forecasts on thin data. Grow the intelligence in stages:

| Stage | When | What it does |
|---|---|---|
| **1 · Rules** (start here) | now | velocity, days-of-cover, reorder point, expiry tiers. Transparent, every number explainable. |
| **2 · Trends** | a few months of data | month-over-month change, simple 30/60/90-day projection from moving averages, "sold 35% faster than last month." |
| **3 · Signals** | once campaigns run | attribute lift to **Instagram/Telegram campaigns**, promotion history, product-request interest → better projections. |
| **4 · ML** | 12+ months, enough SKUs | seasonality, anomaly detection (unexpected spikes/drops), true confidence intervals. |

**Smart insights** (auto-generated one-liners) are great from Stage 2: *"This batch is unlikely
to sell before expiry — start a promotion." · "Telegram outperforms Instagram for this
category." · "Reorder Collagen within 5 days."* Each insight links to the action that resolves it.

> Principle: **every recommendation shows its reasoning and its inputs.** Estimates are
> labeled estimates. That's what makes the admin trust — and act on — the numbers.

---

## 9. Proposed data model (new)

| Table / view | Purpose |
|---|---|
| `product_batches` | batch cost, qty, arrival/expiry, status (§2) |
| `sale_batches` *(or `sales.batch_id`)* | which batch(es) a sale consumed → COGS/FIFO |
| `suppliers` *(optional)* | name, lead-time, contact (§3) |
| `purchase_orders` + `_lines` *(optional)* | reorders that become batches on arrival (§3) |
| `settings` | thresholds: expiry tiers, low-stock mins, lead time, target cover days |
| `promotions` / `promo_redemptions` | reuse from growth-plan Module 2 (§5) |
| `v_batch_status` | per batch: months-to-expiry, expiry tier, value |
| `v_inventory_health` | totals: value, at-risk, potential loss, turnover, shelf age, score |
| `v_purchase_suggestions` | per product: velocity, days-left, reorder point, suggested qty, priority, reason |
| `v_slow_movers` | products with no/low recent sales + age |

Money views (`v_sales_enriched`, balances) change **cost source** to the consumed batch (§2),
otherwise unchanged. Golden rules still hold: **sellers never see cost, margin, or your 60%.**

---

## 10. Admin surface

A single **Inventory Intelligence** area (`/admin/inventory`) with sections:
Inventory Health · Batch Tracking · Expiration Calendar · Low-Stock · Slow-Movers · Purchase
Suggestions · Demand Forecast · Suggested Promotions · Campaign Performance · Inventory Value
· Inventory Risk · (later) Supplier Performance.

Promotion performance analytics (per campaign: revenue before/after, units sold, remaining
inventory, profit lost vs recovered, Telegram clicks, Instagram reach, conversion, **ROI**,
best/worst campaign) — this closes the loop from §5 and tells you which promo types actually work.

---

## 11. Phased rollout (adapted to Camelia's scale)

### Phase 1 — Batches & expiry (the foundation, highest value)
- [ ] `product_batches` + migrate each product to one opening batch (money math unchanged).
- [ ] Turn on **FIFO costing** for new sales; store consumed batch on each sale.
- [ ] **Expiry tiers** + expiration calendar + "expiring soon" widget.

### Phase 2 — Act on the data
- [ ] **Low-stock alerts** + **slow-mover detection**.
- [ ] **Purchase suggestions** table + one-click "create next batch/PO".
- [ ] Basic **Inventory Health dashboard** (value, at-risk, potential loss, turnover).

### Phase 3 — Expiry → promotion → campaign loop
- [ ] **Suggested promotions** by expiry tier → approve → **auto-generate IG/TG/banner copy**
      → post via Module 1. (Depends on growth-plan Module 2 promotions engine.)
- [ ] **Promotion performance analytics**.

### Phase 4 — Smarter over time
- [ ] Trend insights (Stage 2), campaign-attribution (Stage 3).
- [ ] Suppliers + full POs if/when multiple suppliers.
- [ ] ML forecasting, seasonality, anomaly detection (Stage 4) once there's ≥12 months of data.

> **Suggested first:** Phase 1 alone (batches + expiry + FIFO) already delivers the biggest win
> — you stop losing money to expired stock and your profit numbers become truly accurate.

---

## 12. How it fits the other plans
- **Master plan** — extends the data model; keeps every golden rule (cost hidden from sellers,
  math in views not app, seller isolation).
- **Growth plan** — **supersedes Module 3** (restock) with real batch/expiry intelligence;
  **feeds Module 2** (promotions) with expiry-driven campaigns; **uses Module 1** to post them;
  **consumes** the Requests spine (seller restock + wholesale/retail interest) as demand signals.

---

## 13. Success metrics (from the spec — with how we'll measure)
- **Expired inventory ↓ ≥ 80%** — track units expired ÷ units purchased, before vs after.
- **Inventory turnover ↑** — COGS ÷ average inventory value.
- **Manual purchasing decisions ↓** — % of reorders made from a suggestion.
- **Campaign effectiveness ↑** — promotion ROI, clearance recovery rate.
- **Stock availability ↑ / overstocking ↓** — days out-of-stock; average shelf age.
- **Real-time inventory health** — a single Health Score the admin checks daily.

---

## References
- [Reorder Point Formula & Safety Stock (inFlow)][r5]
- [Safety Stock Formula & Calculation (ABC Supply Chain)][r6]

[r5]: https://www.inflowinventory.com/blog/reorder-point-formula-safety-stock/
[r6]: https://abcsupplychain.com/safety-stock-formula-calculation/
