# Expose `category` on the public storefront view — Run in Supabase SQL Editor

The landing page shows **category filter chips**, powered by `products.category`. It reads the
public `v_shop` view (anon key), so `category` must be exposed there. Until this runs, the chips
simply don't appear (the storefront degrades gracefully — it tries `category`, then falls back).

`create or replace` keeps every existing column in the same order and only **appends** `category`,
so nothing that already reads `v_shop` breaks. Based on the definition in
`docs/availability-migration-setup.md` (Block 5).

```sql
create or replace view public.v_shop as
select
  p.id,
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
  ) as gallery,
  a.remaining,
  a.state,
  (a.state in ('in_stock','low')) as buyable,
  (a.incoming_qty > 0)            as restock_coming,
  a.just_arrived,
  p.category                       -- NEW (appended)
from public.products p
join public.v_product_availability a on a.product_id = p.id
where p.discontinued_at is null;

grant select on public.v_shop to anon, authenticated;
```

## Verify
```sql
select id, name, category from public.v_shop limit 5;
```
After this, the landing page shows a chip per distinct category (Krem, Tozalovchi, Quyoshdan
himoya, …) plus "Hammasi".

> ⚠ If your live `v_shop` was customised beyond Block 5, don't paste blindly — add just the
> `p.category` line to your current definition so column order/lengths still match.
