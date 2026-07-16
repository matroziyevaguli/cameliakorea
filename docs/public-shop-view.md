# Public storefront view — Run in Supabase SQL Editor

This lets the **public store** (cameliakorea.com) read products with the **anon key**
(the one already working on Vercel), so it no longer depends on the service-role key.
The view exposes ONLY safe fields — **cost is never included** — and includes a gallery array.

```sql
drop view if exists public.v_shop;

-- SECURITY DEFINER view (default): runs as owner, so it can read products + images
-- regardless of RLS, but exposes only the safe columns below (NO cost).
create view public.v_shop as
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
  ) as gallery
from public.products p;

-- Allow the public (anon) and logged-in (authenticated) roles to READ the view.
grant select on public.v_shop to anon, authenticated;
```

## After running it
- The storefront reads `v_shop` with the anon key → works on Vercel immediately
  (no `SUPABASE_SERVICE_ROLE_KEY` needed for the store).
- `cost` and profit are never in the view, so nothing sensitive is public.
- Verify: `select * from public.v_shop limit 3;` should return rows.
