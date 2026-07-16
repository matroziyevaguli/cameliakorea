# Seller Detail View — Run in Supabase SQL Editor

Creates `v_admin_seller_products` (per seller + product: had / sold / left / revenue / seller_profit),
used by the admin seller detail page `/admin/sellers/[id]`.

```sql
drop view if exists public.v_admin_seller_products;
create view public.v_admin_seller_products with (security_invoker = on) as
select
  a.seller_id,
  p.id                                          as product_id,
  p.name                                        as product_name,
  a.qty_allocated                               as had,
  coalesce(s.sold, 0)                           as sold,
  a.qty_allocated - coalesce(s.sold, 0)         as "left",
  coalesce(s.revenue, 0)                        as revenue,
  coalesce(s.seller_profit, 0)                  as seller_profit
from public.allocations a
join public.products p on p.id = a.product_id
left join (
  select
    seller_id,
    product_id,
    sum(qty)            as sold,
    sum(revenue)        as revenue,
    sum(seller_profit)  as seller_profit
  from public.v_sales_enriched
  group by seller_id, product_id
) s on s.seller_id = a.seller_id and s.product_id = a.product_id;
```

Notes:
- `security_invoker = on` → RLS of the underlying tables applies; admin sees all rows.
- `"left"` is quoted because `left` is a reserved word in Postgres.
- The detail page also reads `v_seller_balances` (owed / submitted / balance) and
  `v_sales_enriched` (individual sales). Those already exist.
- The page has a built-in fallback (v_inventory + v_sales_enriched) so it works even
  before this view is created — but create it for the cleaner query path.
```
