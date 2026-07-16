# Link Column Setup — Run in Supabase SQL Editor

```sql
-- Add link column to products
alter table public.products add column if not exists link text;

-- Rebuild v_catalog to include link (and description if not already there)
drop view if exists public.v_catalog;
create view public.v_catalog with (security_invoker = on) as
select
  p.id             as product_id,
  p.name,
  p.retail_price,
  p.discount_price,
  p.image_url,
  p.description,
  p.link
from public.products p
join public.allocations a on a.product_id = p.id
where a.seller_id = public.my_profile_id();
```
