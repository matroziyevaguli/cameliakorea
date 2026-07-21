# Cancelled sales — view filters (finishes D7) · Run in Supabase SQL Editor

Written from the **actual** definitions you pasted on 2026-07-22, not from guesses.

Once this runs, `sales.cancelled_at` becomes real: a cancelled sale stops counting as
revenue, profit, debt and stock — everywhere — and **G4** can ship (hard delete →
"Bekor qilingan" with a reason and an audit row).

---

## The one design choice

**`v_my_sales` deliberately keeps cancelled rows** and simply exposes `cancelled_at`, so
the seller still *sees* what she cancelled (greyed, with a chip) instead of it silently
vanishing — same treatment returns already get. **Every aggregate view filters them out.**
Her on-screen totals exclude them client-side.

Everything else excludes cancelled rows at the database level.

---

## Before you start — confirm these are definer views

All eight rely on `my_profile_id()` / RLS-bypassing reads, so they must **not** be
`security_invoker`. Run this first:

```sql
select c.relname, c.reloptions
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('v_my_sales','v_my_summary','v_my_monthly','v_my_inventory',
                    'v_sales_enriched','v_product_stats','v_seller_balances',
                    'v_inventory','v_product_availability');
```

Every row should show `reloptions` = `NULL` (or without `security_invoker=true`).
**If any shows `security_invoker=true`, stop and tell me** — replacing it would change
who can read what.

---

## Block 1 — `v_my_sales` (keeps cancelled rows, adds the flag)

```sql
create or replace view public.v_my_sales as
 SELECT s.id,
    s.sold_at,
    p.name AS product_name,
    s.qty,
    s.unit_price,
    s.qty::numeric * s.unit_price AS amount,
    round(s.qty::numeric * (s.unit_price - p.cost) * pr.commission_rate) AS your_profit,
    s.cancelled_at,
    s.cancel_reason
   FROM sales s
     JOIN products p ON p.id = s.product_id
     JOIN profiles pr ON pr.id = s.seller_id
  WHERE s.seller_id = my_profile_id();
```

## Block 2 — `v_my_summary` (her money — must exclude)

```sql
create or replace view public.v_my_summary as
 WITH my AS (
         SELECT my_profile_id() AS pid
        ), agg AS (
         SELECT COALESCE(sum(s.qty::numeric * (s.unit_price - p.cost) * pr.commission_rate), 0::numeric) AS profit,
            COALESCE(sum(s.qty::numeric * s.unit_price - s.qty::numeric * (s.unit_price - p.cost) * pr.commission_rate), 0::numeric) AS owed
           FROM sales s
             JOIN products p ON p.id = s.product_id
             JOIN profiles pr ON pr.id = s.seller_id
          WHERE s.seller_id = (( SELECT my.pid FROM my))
            AND s.cancelled_at IS NULL                      -- ← added
        ), pay AS (
         SELECT COALESCE(sum(payments.amount), 0::numeric) AS submitted
           FROM payments
          WHERE payments.seller_id = (( SELECT my.pid FROM my))
        ), op AS (
         SELECT COALESCE(profiles.opening_balance, 0::numeric) AS ob
           FROM profiles
          WHERE profiles.id = (( SELECT my.pid FROM my))
        )
 SELECT round(agg.profit) AS your_total_profit,
    round(op.ob + agg.owed) AS total_owed,
    round(pay.submitted) AS submitted,
    round(op.ob + agg.owed - pay.submitted) AS not_submitted
   FROM agg, pay, op;
```

## Block 3 — `v_my_monthly`

```sql
create or replace view public.v_my_monthly as
 SELECT to_char(s.sold_at, 'YYYY-MM'::text) AS month,
    sum(s.qty) AS units_sold,
    sum(s.qty::numeric * s.unit_price) AS revenue,
    sum(s.qty::numeric * (s.unit_price - p.cost) * pr.commission_rate) AS your_profit
   FROM sales s
     JOIN products p ON p.id = s.product_id
     JOIN profiles pr ON pr.id = s.seller_id
  WHERE s.seller_id = my_profile_id()
    AND s.cancelled_at IS NULL                               -- ← added
  GROUP BY (to_char(s.sold_at, 'YYYY-MM'::text))
  ORDER BY (to_char(s.sold_at, 'YYYY-MM'::text));
```

## Block 4 — `v_my_inventory` (a cancelled sale returns stock)

```sql
create or replace view public.v_my_inventory as
 SELECT a.product_id,
    p.name AS product_name,
    a.qty_allocated AS had,
    COALESCE(s.qty_sold, 0::bigint) AS sold,
    COALESCE(adj.q, 0::bigint) AS adjusted,
    a.qty_allocated - COALESCE(s.qty_sold, 0::bigint) - COALESCE(adj.q, 0::bigint) AS remaining
   FROM allocations a
     JOIN products p ON p.id = a.product_id
     LEFT JOIN ( SELECT sales.product_id,
            sum(sales.qty) AS qty_sold
           FROM sales
          WHERE sales.seller_id = my_profile_id()
            AND sales.cancelled_at IS NULL                   -- ← added
          GROUP BY sales.product_id) s ON s.product_id = a.product_id
     LEFT JOIN ( SELECT stock_adjustments.product_id,
            sum(stock_adjustments.qty) AS q
           FROM stock_adjustments
          WHERE stock_adjustments.seller_id = my_profile_id()
          GROUP BY stock_adjustments.product_id) adj ON adj.product_id = a.product_id
  WHERE a.seller_id = my_profile_id();
```

## Block 5 — `v_sales_enriched` (the admin's money spine)

```sql
create or replace view public.v_sales_enriched as
 SELECT s.id,
    s.seller_id,
    pr.full_name AS seller_name,
    s.product_id,
    p.name AS product_name,
    s.qty,
    s.unit_price,
    s.sold_at,
    s.qty::numeric * s.unit_price AS revenue,
    s.qty::numeric * p.cost AS cost_total,
    s.qty::numeric * (s.unit_price - p.cost) AS margin,
    s.qty::numeric * (s.unit_price - p.cost) * pr.commission_rate AS seller_profit,
    s.qty::numeric * (s.unit_price - p.cost) * (1::numeric - pr.commission_rate) AS my_profit,
    s.qty::numeric * s.unit_price - s.qty::numeric * (s.unit_price - p.cost) * pr.commission_rate AS owed_to_me
   FROM sales s
     JOIN products p ON p.id = s.product_id
     JOIN profiles pr ON pr.id = s.seller_id
  WHERE s.cancelled_at IS NULL;                              -- ← added
```

> **`v_seller_balances` needs no change** — it aggregates `v_sales_enriched`, so Block 5
> fixes it automatically. Same for the admin dashboard, payments and stats pages.

## Block 6 — `v_product_stats`

The filter goes in the **JOIN**, not a `WHERE` — a `WHERE` would turn the `LEFT JOIN`
into an inner join and drop every product that has never sold.

```sql
create or replace view public.v_product_stats as
 SELECT p.id AS product_id,
    p.name,
    p.total_qty,
    COALESCE(sum(s.qty), 0::bigint) AS units_sold,
    p.total_qty - COALESCE(sum(s.qty), 0::bigint) - COALESCE(( SELECT sum(a.qty) AS sum
           FROM stock_adjustments a
          WHERE a.product_id = p.id), 0::bigint) AS units_remaining,
    COALESCE(sum(s.qty::numeric * s.unit_price), 0::numeric) AS revenue
   FROM products p
     LEFT JOIN sales s ON s.product_id = p.id AND s.cancelled_at IS NULL   -- ← added
  GROUP BY p.id, p.name, p.total_qty;
```

## Block 7 — `v_inventory` (admin distribute)

```sql
create or replace view public.v_inventory as
 SELECT a.seller_id,
    pr.full_name AS seller_name,
    a.product_id,
    p.name AS product_name,
    a.qty_allocated,
    COALESCE(sold.q, 0::bigint) AS qty_sold,
    a.qty_allocated - COALESCE(sold.q, 0::bigint) - COALESCE(adj.q, 0::bigint) AS qty_remaining
   FROM allocations a
     JOIN products p ON p.id = a.product_id
     JOIN profiles pr ON pr.id = a.seller_id
     LEFT JOIN ( SELECT sales.seller_id,
            sales.product_id,
            sum(sales.qty) AS q
           FROM sales
          WHERE sales.cancelled_at IS NULL                   -- ← added
          GROUP BY sales.seller_id, sales.product_id) sold ON sold.seller_id = a.seller_id AND sold.product_id = a.product_id
     LEFT JOIN ( SELECT stock_adjustments.seller_id,
            stock_adjustments.product_id,
            sum(stock_adjustments.qty) AS q
           FROM stock_adjustments
          GROUP BY stock_adjustments.seller_id, stock_adjustments.product_id) adj ON adj.seller_id = a.seller_id AND adj.product_id = a.product_id;
```

## Block 8 — `v_product_availability` (storefront stock)

**Easy to miss.** This is the view added by `availability-migration-setup.md`; its `sold`
CTE sums `sales` too, so without this a cancelled sale would keep a product looking
sold-out to customers. Column list is unchanged, so `create or replace` is safe and
`v_shop` / `v_catalog` keep working.

```sql
create or replace view public.v_product_availability as
with batch_agg as (
  select
    product_id,
    coalesce(sum(quantity) filter (where status = 'arrived'), 0)                 as received_qty,
    coalesce(sum(quantity) filter (where status in ('ordered','in_transit')), 0) as incoming_qty,
    max(received_date) filter (where status = 'arrived')                         as last_arrival,
    min(eta)           filter (where status in ('ordered','in_transit'))         as soonest_eta
  from public.product_batches
  group by product_id
),
sold as (
  select product_id, coalesce(sum(qty), 0) as units_sold
  from public.sales
  where cancelled_at is null                                  -- ← added
  group by product_id
),
base as (
  select
    p.id                                as product_id,
    p.discontinued_at,
    case when coalesce(b.received_qty, 0) > 0
         then b.received_qty
         else p.total_qty end           as received_qty,
    coalesce(b.incoming_qty, 0)         as incoming_qty,
    b.last_arrival,
    b.soonest_eta,
    coalesce(s.units_sold, 0)           as units_sold
  from public.products p
  left join batch_agg b on b.product_id = p.id
  left join sold      s on s.product_id = p.id
)
select
  product_id,
  received_qty,
  incoming_qty,
  last_arrival,
  soonest_eta,
  greatest(received_qty - units_sold, 0) as remaining,
  case
    when discontinued_at is not null                            then 'discontinued'
    when received_qty = 0 and incoming_qty > 0                  then 'not_arrived'
    when received_qty - units_sold <= 0 and incoming_qty > 0     then 'sold_out_incoming'
    when received_qty - units_sold <= 0                          then 'sold_out'
    when received_qty - units_sold <= 2                          then 'low'
    else                                                              'in_stock'
  end as state,
  (last_arrival is not null and last_arrival >= current_date - 3) as just_arrived
from base;
```

---

## Verify

Nothing should change yet — no sale is cancelled, so every number must be **identical**.

```sql
-- 1. Nothing is cancelled yet → these must all be 0
select count(*) as cancelled_rows from public.sales where cancelled_at is not null;

-- 2. Spot-check the money spine still returns every sale
select count(*) from public.v_sales_enriched;      -- compare to: select count(*) from sales;

-- 3. Products that never sold must still appear (the LEFT JOIN trap in Block 6)
select count(*) from public.v_product_stats;       -- must equal: select count(*) from products;

-- 4. Storefront unchanged
select count(*) from public.v_shop;
```

### Then a real end-to-end te

```sql
-- Pick any sale, note the seller's numbers first:
select * from public.v_seller_balances where seller_name = 'GULSHAN';

-- Cancel it:
update public.sales set cancelled_at = now(), cancel_reason = 'test'
where id = '<sale-uuid>';

-- Her owed + revenue must DROP by that sale's amount, and stock must come back:
select * from public.v_seller_balances where seller_name = 'GULSHAN';

-- Undo:
update public.sales set cancelled_at = null, cancel_reason = null where id = '<sale-uuid>';
```

Once that behaves, tell me and I'll ship the **"Bekor qilingan"** UI (reason chips,
greyed row, audit rows in `sale_edits`) plus inline price editing — your `pg_policy`
output already confirmed the seller may update her own sales.
