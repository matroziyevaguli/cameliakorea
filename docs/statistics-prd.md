# PRD — Statistics / P&L page ("Hisobot")

**Status:** draft for approval · **Owner:** Gulchiroy · **Date:** 2026-09-05

---

## 1. Summary
An admin-only analytics page that answers one question at a glance: **are we making money or
losing money, and is it improving?** It combines sales, costs, seller commissions, **rent
(arenda)** and other expenses into a real profit/loss view over time, plus **who owes money**
(sellers who haven't paid yet) and **which seller is actually profitable**.

## 2. Problem / why
Today the admin dashboard shows revenue and units, but there's no true **net profit**: rent isn't
tracked anywhere, and "profit on paper" hides that **some sellers haven't paid** (GULSHAN's
balance ≈ 2.23M so'm, ADOLAT ≈ 1.97M so'm are already outstanding). So the owner can't tell if the
business is genuinely up or down month to month, or whether unpaid balances are becoming a risk.

## 3. Goals
- One-glance verdict: **net profit this period + trend vs last period** (up/down).
- A monthly **trend** so you can see improving vs declining.
- Track **rent + expenses** so profit is real, not just gross.
- Separate **money earned (accrual)** from **money actually collected (cash)** — because sellers
  pay late.
- See **per-seller profitability** and **who owes what, how overdue** (receivables aging).

## 4. Non-goals (v1)
- Full accounting/ledger, tax, or exportable statements.
- Multi-currency engine (rent is entered in so'm; USD shown as a note — see §11).
- Forecasting/AI predictions (maybe later).

## 5. Persona
**Admin (Gulchiroy)** only. Reached from AdminNav (or folded into Boshqaruv as a "Hisobot" tab).

## 6. Questions the page must answer
1. This month, did I make or lose money (after rent)? By how much? Better than last month?
2. How much have I actually **collected** vs how much is **still owed** to me?
3. Which sellers make me the most profit — and which are slow to pay?
4. What are my costs (goods, commissions, rent, giveaways) and where's the money going?
5. Which products drive profit?

## 7. Data — what exists + what's new
**Exists (reuse):**
- `v_sales_enriched` — per sale: `revenue, cost_total (COGS), margin, seller_profit (commission),
  my_profit (owner profit), owed_to_me`, `sold_at`, seller, product.
- `v_seller_balances` — `total_owed, received, balance` (receivables per seller).
- `payments` — cash received (`amount, paid_at`).
- `v_product_stats` — per-product units_sold / revenue; `products.cost` for margins.
- `stock_adjustments` (reason `gift`) — giveaways (cost the business absorbs).

**New — `money_entries` table** (flexible expenses/outflows). Each entry has a **category** and a
**source**, and the **source decides whether it reduces your profit**:
`id, category ('rent'|'delivery'|'marketing'|'other'), amount (so'm), incurred_on (date),
source ('cash'|'card'|'seller'), seller_id (nullable — set when source='seller'), note, created_at`.
- **source = cash / card** → *you* paid it → counts as **your expense** (reduces net profit; lowers cash).
- **source = seller** → it's **subtracted from that seller's balance** (they cover it from what they
  owe you) → **does NOT reduce your profit**; it lowers that seller's receivable instead.

So rent is entered as two lines each month: your $50 as **cash/card** (hits profit) and Gulshan's
$50 as **seller = Gulshan** (reduces her debt, not your profit). SQL as `docs/statistics-setup.md`.
Seller balances gain a "credits" component (Σ of `source='seller'` entries) subtracted from
`total_owed`, kept separate from cash `received` so the cash KPI stays truthful.

## 8. Metric definitions (precise)
For a selected period (by `sold_at` / `paid_at` / `incurred_on`):
- **Revenue** = Σ `revenue`.
- **COGS** = Σ `cost_total`. **Gross margin** = Σ `margin` = Revenue − COGS.
- **Seller commissions** = Σ `seller_profit`.
- **Owner gross profit** = Σ `my_profit` (= margin − commissions).
- **Your expenses** = Σ `money_entries.amount` where `source IN ('cash','card')` in period (rent
  your-half + delivery + …). **Giveaway cost** = Σ (gift qty × product.cost).
- **Net profit (yours)** = Owner gross profit − Your expenses − Giveaway cost. ← headline.
- **Seller-covered outflows** = Σ `money_entries.amount` where `source='seller'` → reduce that
  seller's balance; **not** part of your net profit.
- **Cash collected** = Σ `payments.amount` (real cash/card in from sellers; seller-credits excluded).
- **Outstanding (receivables)** = Σ (`total_owed` − `received` − seller-credits), point-in-time.
- **Margin %** = Owner gross profit ÷ Revenue. **DSO** (days sales outstanding) ≈ Outstanding ÷
  (Revenue ÷ period-days) — "how many days of sales are unpaid."

## 9. UX / layout (grounded in dashboard best practice)
Best practice: **decision-first, 5–10 KPIs, top-rail filters, trend + variance, color = meaning,
6–8 visuals/screen, receivables aging in 30-day buckets with green/yellow/red.** Layout top→bottom:

1. **Top rail:** period selector (Bu oy / O'tgan oy / 3 oy / 12 oy / custom); everything reacts.
2. **Headline verdict card:** big **Net profit** for the period, green ▲ / red ▼ vs previous
   period, with a one-line "Foyda / Zarar" label. This is the "are we making money" answer.
3. **KPI row (6):** Daromad (revenue) · Sof foyda (net) · Xarajatlar (expenses incl. rent) ·
   Qo'lga tushgan (cash collected) · Qarz (outstanding) · Margin %. Each with ▲/▼ vs last period.
4. **Trend chart:** monthly **Revenue vs Net profit** bars/line over the last 6–12 months — the
   "improving or declining" view. (Recharts, already used on `/admin`.)
5. **P&L breakdown (waterfall/list):** Revenue → −COGS → Gross → −Commissions → −Rent/expenses →
   −Giveaways → **Net** — shows where the money goes.
6. **Cash vs earned:** small paired stat — earned (accrual) vs collected (cash) + the gap
   (= new receivables), so late payments are visible.
7. **Sellers table:** per seller — revenue, **your profit generated**, commission they earned,
   **balance owed**, last payment date, **status chip** (green paid-up / yellow slow / red
   overdue). Sortable; answers "which seller makes money" and "who's slow."
8. **Receivables aging:** each seller's unpaid balance bucketed **0–15 / 16–30 / 31–60 / 60+
   kun**, color-coded, computed by FIFO-allocating payments against sales by date. The late-payer
   risk, front and center.
9. **Top products by profit** (bar/table).
10. **Money-entry panel:** add an outflow → pick **category** (rent / delivery / marketing /
    other), **amount**, **date**, and **source** (Naqd / Karta / Sotuvchidan ayirish → choose
    seller). Cash/card lines hit your profit; seller lines reduce that seller's balance. List +
    edit/delete recent entries.

Charts follow the dataviz guidance (one accessible palette, green=good/up, red=loss/down, light+dark).

## 10. Rollout
1. `docs/statistics-setup.md` — `money_entries` table + a `seller-credits` component folded into
   the balance calc (+ optional `v_pnl_monthly` view for the trend).
2. Read-only page: KPIs + trend + P&L + sellers + aging (from existing views + money_entries).
3. Money-entry panel (category + source, incl. subtract-from-seller).
4. Polish: period compare, product profit, dark mode.

## 11. Open questions / decisions (defaults in **bold**)
1. **Rent (confirmed):** total **$100/month**, in so'm, from **August 2026**, entered as two
   `money_entries{category:'rent'}` lines per month:
   - **Your $50** with `source = cash` or `card` → counts as your expense (reduces net profit).
   - **Gulshan's $50** with `source = seller` (Gulshan) → reduces her balance, **not** your profit.
   (Recurring helper can pre-fill these monthly; confirm the so'm amount per $ at entry.)
2. **Source decides profit (confirmed):** cash/card = your expense; "subtract from a seller" =
   that seller covers it → reduces their receivable, never your profit.
3. **Headline (confirmed):** **your net profit** (`my_profit − your cash/card expenses −
   giveaways`); shop-wide margin shown in the P&L breakdown for context.
4. **Currency:** amounts entered in **so'm** (type the month's so'm figure; optional USD note).
   USD×rate can come later.
5. **Giveaways** counted as your loss? → **Yes** (cost the business absorbed).
6. **Seller late-payment threshold** for the red "overdue" chip → default **30 days** since last
   payment. Confirm if different.
7. Telegram reminders to slow-paying sellers — **later**.

## 12. Success criteria
- Selecting a period shows a correct **Net profit** = revenue − COGS − commissions − expenses −
  giveaways, with a clear making/losing verdict and vs-last-period arrow.
- Rent entered once (recurring) flows into every month's net.
- Outstanding total matches Σ seller balances; aging buckets sum to it.
- Per-seller table ranks profitability and flags slow payers.

---

Sources (dashboard/UX best practice):
- [Eleken — Financial dashboard examples & best practices](https://www.eleken.co/blog-posts/financial-dashboard-examples)
- [DataCamp — Effective dashboard design](https://www.datacamp.com/tutorial/dashboard-design-tutorial)
- [TC Advisors — Small-business KPI dashboard: 10 numbers that matter](https://tcadvisorscpa.com/kpi-dashboard-small-business/)
- [NetSuite — Accounts receivable dashboard](https://www.netsuite.com/portal/resource/articles/accounting/accounts-receivable-ar-dashboard.shtml)
- [Brex — Accounts receivable aging reports](https://www.brex.com/spend-trends/accounting/accounts-receivable-aging-reports)
