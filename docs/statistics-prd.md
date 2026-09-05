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

**New — `expenses` table** (rent + one-offs):
`id, category ('rent'|'marketing'|'other'), amount (so'm), incurred_on (date), recurring (bool),
note, created_at`. Rent is a monthly recurring expense; the page sums expenses per period. SQL as
`docs/statistics-setup.md` (owner runs).

## 8. Metric definitions (precise)
For a selected period (by `sold_at` / `paid_at` / `incurred_on`):
- **Revenue** = Σ `revenue`.
- **COGS** = Σ `cost_total`. **Gross margin** = Σ `margin` = Revenue − COGS.
- **Seller commissions** = Σ `seller_profit`.
- **Owner gross profit** = Σ `my_profit` (= margin − commissions).
- **Expenses** = Σ `expenses.amount` (rent + other) in period. **Giveaway cost** = Σ (gift qty ×
  product.cost).
- **Net profit** = Owner gross profit − Expenses − Giveaway cost. ← the headline (making/losing).
- **Cash collected** = Σ `payments.amount`.
- **Outstanding (receivables)** = Σ `v_seller_balances.balance` (point-in-time).
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
10. **Expenses panel:** add/edit rent + other expenses (records into `expenses`); recurring rent
    auto-counts each month.

Charts follow the dataviz guidance (one accessible palette, green=good/up, red=loss/down, light+dark).

## 10. Rollout
1. `docs/statistics-setup.md` — `expenses` table (+ optional `v_pnl_monthly` view for the trend).
2. Read-only page: KPIs + trend + P&L + sellers + aging (from existing views + expenses).
3. Expenses panel (add rent/one-offs).
4. Polish: period compare, product profit, dark mode.

## 11. Open questions / decisions (defaults in **bold**)
1. **Rent details:** what's the **total monthly rent**, and what's *your* share to count as an
   expense? You said "Gulshan pays $100/month, I pay half the rent." → I'll model a monthly rent
   expense = **your share**; confirm the exact so'm amount (and whether Gulshan's $100 is her share
   of the same rent or separate).
2. **Currency:** rent is quoted in **$**, sales in so'm. v1 = **enter rent in so'm** (you type the
   month's so'm figure; optional USD note). Add a USD×rate later if wanted.
3. **Whose profit?** Headline = **owner's net** (`my_profit − your expenses`). Also show the
   whole-shop margin as context? (default: owner's view, shop margin shown in the P&L breakdown.)
4. **Giveaways** counted as an expense/loss? → **Yes** (cost the business absorbed).
5. **Seller late-payment threshold** for the red "overdue" chip (e.g. > 30 days since last
   payment, or balance older than 30 days)? default **30 days**.
6. Reminders to slow-paying sellers (Telegram) — later?

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
