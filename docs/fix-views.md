# Fix drifted views — Run in Supabase SQL Editor

Your database has two views whose shape drifted from what the app expects. The app code
now tolerates both, but running this makes everything (incl. the gallery) work cleanly.

## 1. v_catalog — must be per-seller and expose `product_id` + `gallery`

The installed version returns `id` (not `product_id`) and lists ALL products instead of
only the logged-in seller's allocated ones. This broke the seller "record a sale" page
(now worked around in code) and the product gallery. Recreate it correctly:

```sql
drop view if exists public.v_catalog;
create view public.v_catalog with (security_invoker = on) as
select
  p.id             as product_id,
  p.name,
  p.retail_price,
  p.discount_price,
  p.image_url,
  p.description,
  p.link,
  coalesce(
    (select json_agg(pi.url order by pi.sort_order asc)
     from public.product_images pi
     where pi.product_id = p.id),
    '[]'::json
  ) as gallery
from public.products p
join public.allocations a on a.product_id = p.id
where a.seller_id = public.my_profile_id();
```

## 2. v_admin_seller_products — standardize the "left" column name

Your installed view names the remaining-stock column `remaining`. The admin seller
detail page now reads either `left` or `remaining`, so this is OPTIONAL. To standardize:

```sql
drop view if exists public.v_admin_seller_products;
create view public.v_admin_seller_products with (security_invoker = on) as
select
  a.seller_id,
  pr.full_name                                  as seller_name,
  p.id                                          as product_id,
  p.name                                        as product_name,
  a.qty_allocated                               as had,
  coalesce(s.sold, 0)                           as sold,
  a.qty_allocated - coalesce(s.sold, 0)         as remaining,
  coalesce(s.revenue, 0)                        as revenue,
  coalesce(s.seller_profit, 0)                  as seller_profit
from public.allocations a
join public.products p  on p.id  = a.product_id
join public.profiles pr on pr.id = a.seller_id
left join (
  select seller_id, product_id,
         sum(qty)            as sold,
         sum(revenue)        as revenue,
         sum(seller_profit)  as seller_profit
  from public.v_sales_enriched
  group by seller_id, product_id
) s on s.seller_id = a.seller_id and s.product_id = a.product_id;
```
