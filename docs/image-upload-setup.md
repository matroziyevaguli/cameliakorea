# Image Upload Setup

## Step 1 — Run in Supabase SQL Editor

```sql
-- Add image_url column to products
alter table public.products add column if not exists image_url text;

-- Update v_catalog to expose real image_url (was null placeholder)
drop view if exists public.v_catalog;
create view public.v_catalog with (security_invoker = on) as
select
  p.id             as product_id,
  p.name,
  p.retail_price,
  p.discount_price,
  p.image_url
from public.products p
join public.allocations a on a.product_id = p.id
where a.seller_id = public.my_profile_id();
```

## Step 2 — Create the storage bucket

1. Go to Supabase dashboard → **Storage** → **New bucket**
2. Name: `product-images`
3. Toggle **Public bucket** ON (so images load without auth)
4. Click **Create bucket**

That's it — the app handles the rest.
