# New Seller Views — Run in Supabase SQL Editor

Paste the entire block below into SQL Editor → New query → Run.
Safe to re-run (all drops are guarded).

```sql
-- ── v_catalog ─────────────────────────────────────────────────────────
-- Products allocated to this seller (for product cards + sale form)
drop view if exists public.v_catalog;
create view public.v_catalog with (security_invoker = on) as
select
  p.id             as product_id,
  p.name,
  p.retail_price,
  p.discount_price,
  null::text       as image_url
from public.products p
join public.allocations a on a.product_id = p.id
where a.seller_id = public.my_profile_id();

-- ── v_my_inventory ────────────────────────────────────────────────────
-- Stock status (had / sold / remaining) for this seller
drop view if exists public.v_my_inventory;
create view public.v_my_inventory with (security_invoker = on) as
select
  a.product_id,
  p.name                                              as product_name,
  a.qty_allocated                                     as had,
  coalesce(s.qty_sold, 0)                             as sold,
  a.qty_allocated - coalesce(s.qty_sold, 0)          as remaining
from public.allocations a
join public.products p on p.id = a.product_id
left join (
  select product_id, sum(qty) as qty_sold
  from public.sales
  where seller_id = public.my_profile_id()
  group by product_id
) s on s.product_id = a.product_id
where a.seller_id = public.my_profile_id();

-- ── v_my_summary ──────────────────────────────────────────────────────
-- Financial summary: profit, submitted, not_submitted
drop view if exists public.v_my_summary;
create view public.v_my_summary with (security_invoker = on) as
with sales_agg as (
  select
    pr.id,
    pr.opening_balance,
    pr.commission_rate,
    coalesce(sum((s.qty * (s.unit_price - p.cost)) * pr.commission_rate), 0)                                  as your_total_profit,
    coalesce(sum(s.qty * s.unit_price - (s.qty * (s.unit_price - p.cost)) * pr.commission_rate), 0)           as owed_from_sales
  from public.profiles pr
  left join public.sales s    on s.seller_id  = pr.id
  left join public.products p on p.id         = s.product_id
  where pr.id = public.my_profile_id()
  group by pr.id, pr.opening_balance, pr.commission_rate
),
pay_agg as (
  select coalesce(sum(amount), 0) as submitted
  from public.payments
  where seller_id = public.my_profile_id()
)
select
  sa.id                                              as seller_id,
  sa.your_total_profit,
  sa.opening_balance + sa.owed_from_sales            as total_owed,
  pa.submitted,
  sa.opening_balance + sa.owed_from_sales - pa.submitted as not_submitted
from sales_agg sa
cross join pay_agg pa;

-- ── v_my_sales ────────────────────────────────────────────────────────
-- This seller's sales — exposes your_profit, hides cost & admin profit
drop view if exists public.v_my_sales;
create view public.v_my_sales with (security_invoker = on) as
select
  s.id,
  p.name                                                            as product_name,
  s.qty,
  s.unit_price,
  s.qty * s.unit_price                                             as revenue,
  (s.qty * (s.unit_price - p.cost)) * pr.commission_rate          as your_profit,
  s.sold_at,
  s.note
from public.sales s
join public.products p  on p.id  = s.product_id
join public.profiles pr on pr.id = s.seller_id
where s.seller_id = public.my_profile_id();

-- ── v_my_monthly ─────────────────────────────────────────────────────
-- Monthly profit + units sold (for the bar chart)
drop view if exists public.v_my_monthly;
create view public.v_my_monthly with (security_invoker = on) as
select
  to_char(s.sold_at, 'YYYY-MM')                                   as month,
  to_char(s.sold_at, 'Mon')                                       as month_label,
  sum((s.qty * (s.unit_price - p.cost)) * pr.commission_rate)     as your_profit,
  sum(s.qty)                                                       as units_sold
from public.sales s
join public.products p  on p.id  = s.product_id
join public.profiles pr on pr.id = s.seller_id
where s.seller_id = public.my_profile_id()
group by to_char(s.sold_at, 'YYYY-MM'), to_char(s.sold_at, 'Mon')
order by month;
```
