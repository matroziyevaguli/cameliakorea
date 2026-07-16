# Stock adjustments — Run in Supabase SQL Editor

Record **damaged / lost / gifted** units so `remaining` always matches reality. An
adjustment reduces STOCK only — it is NOT a sale, so revenue/profit/balances are untouched.
The stock views below subtract adjustments; the money views are left alone.

## 1. The table
```sql
create table if not exists public.stock_adjustments (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid references public.profiles(id) on delete cascade,   -- who had the unit
  product_id  uuid not null references public.products(id) on delete cascade,
  qty         integer not null check (qty > 0),                        -- units removed from stock
  reason      text not null check (reason in ('damaged','lost','gift','other')),
  note        text,
  created_at  timestamptz not null default now()
);

alter table public.stock_adjustments enable row level security;

drop policy if exists adj_admin_all on public.stock_adjustments;
create policy adj_admin_all on public.stock_adjustments for all
  using ( public.is_admin() ) with check ( public.is_admin() );

drop policy if exists adj_seller_read on public.stock_adjustments;
create policy adj_seller_read on public.stock_adjustments for select
  using ( public.is_admin() or seller_id = public.my_profile_id() );
```

## 2. Stock views — subtract adjustments (paste the whole block)
```sql
-- seller's own inventory
-- NOTE: NO security_invoker → SECURITY DEFINER, so it bypasses the products RLS that
-- blocks sellers (my_profile_id() still scopes it to the logged-in seller). Do NOT add
-- security_invoker here or sellers get 0 rows.
drop view if exists public.v_my_inventory;
create view public.v_my_inventory as
select a.product_id, p.name as product_name, a.qty_allocated as had,
  coalesce(s.qty_sold, 0) as sold,
  coalesce(adj.q, 0) as adjusted,
  a.qty_allocated - coalesce(s.qty_sold, 0) - coalesce(adj.q, 0) as remaining
from public.allocations a
join public.products p on p.id = a.product_id
left join (select product_id, sum(qty) qty_sold from public.sales where seller_id = public.my_profile_id() group by product_id) s on s.product_id = a.product_id
left join (select product_id, sum(qty) q from public.stock_adjustments where seller_id = public.my_profile_id() group by product_id) adj on adj.product_id = a.product_id
where a.seller_id = public.my_profile_id();

-- admin per-seller inventory
drop view if exists public.v_inventory;
create view public.v_inventory with (security_invoker = on) as
select a.seller_id, pr.full_name as seller_name, a.product_id, p.name as product_name,
  a.qty_allocated, coalesce(sold.q, 0) as qty_sold,
  a.qty_allocated - coalesce(sold.q, 0) - coalesce(adj.q, 0) as qty_remaining
from public.allocations a
join public.products p on p.id = a.product_id
join public.profiles pr on pr.id = a.seller_id
left join (select seller_id, product_id, sum(qty) q from public.sales group by seller_id, product_id) sold on sold.seller_id = a.seller_id and sold.product_id = a.product_id
left join (select seller_id, product_id, sum(qty) q from public.stock_adjustments group by seller_id, product_id) adj on adj.seller_id = a.seller_id and adj.product_id = a.product_id;

-- admin seller-detail products
drop view if exists public.v_admin_seller_products;
create view public.v_admin_seller_products with (security_invoker = on) as
select a.seller_id, pr.full_name as seller_name, p.id as product_id, p.name as product_name,
  a.qty_allocated as had, coalesce(s.sold, 0) as sold,
  a.qty_allocated - coalesce(s.sold, 0) - coalesce(adj.q, 0) as remaining,
  coalesce(s.revenue, 0) as revenue, coalesce(s.seller_profit, 0) as seller_profit
from public.allocations a
join public.products p on p.id = a.product_id
join public.profiles pr on pr.id = a.seller_id
left join (select seller_id, product_id, sum(qty) sold, sum(revenue) revenue, sum(seller_profit) seller_profit from public.v_sales_enriched group by seller_id, product_id) s on s.seller_id = a.seller_id and s.product_id = a.product_id
left join (select seller_id, product_id, sum(qty) q from public.stock_adjustments group by seller_id, product_id) adj on adj.seller_id = a.seller_id and adj.product_id = a.product_id;

-- product stats (admin)
drop view if exists public.v_product_stats;
create view public.v_product_stats with (security_invoker = on) as
select p.id as product_id, p.name, p.total_qty,
  coalesce(sum(s.qty), 0) as units_sold,
  p.total_qty - coalesce(sum(s.qty), 0) - coalesce((select sum(qty) from public.stock_adjustments a where a.product_id = p.id), 0) as units_remaining,
  coalesce(sum(s.qty * s.unit_price), 0) as revenue
from public.products p
left join public.sales s on s.product_id = p.id
group by p.id, p.name, p.total_qty;

-- public store availability
drop view if exists public.v_shop;
create view public.v_shop as
select p.id, p.name, p.retail_price, p.discount_price, p.image_url, p.description, p.link,
  coalesce((select json_agg(pi.url order by pi.sort_order asc) from public.product_images pi where pi.product_id = p.id), '[]'::json) as gallery,
  greatest(
    p.total_qty
    - coalesce((select sum(qty) from public.sales s where s.product_id = p.id), 0)
    - coalesce((select sum(qty) from public.stock_adjustments a where a.product_id = p.id), 0),
    0) as remaining
from public.products p;
grant select on public.v_shop to anon, authenticated;
```

## Note
Record adjustments in the app on **/admin/sellers/[id]** ("Ombor tuzatish"). Removing a
unit here lowers that seller's `remaining` and the product's store availability, but never
touches money.
