# Seller can set expiry — Run in Supabase SQL Editor

Adds `expiry_date` to `v_catalog` so sellers can see/set it on their product cards.
Recreated as SECURITY DEFINER (no `security_invoker`) so sellers can read it.

```sql
drop view if exists public.v_catalog;
create view public.v_catalog as
select
  p.id,
  p.name,
  p.retail_price,
  p.discount_price,
  p.image_url,
  p.description,
  p.link,
  p.expiry_date,
  coalesce(
    (select json_agg(pi.url order by pi.sort_order asc)
     from public.product_images pi where pi.product_id = p.id),
    '[]'::json
  ) as gallery
from public.products p;

grant select on public.v_catalog to anon, authenticated;
```

Sellers set the date on their **Mahsulotlar** cards; the write goes through `/api/set-expiry`,
which only lets a seller edit a product **allocated to her** (and only the expiry field —
never price/cost). Admin can set it too, from Products.
