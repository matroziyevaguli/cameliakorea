# Gallery Setup — Run in Supabase SQL Editor

```sql
-- 1. New table for gallery images
create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_images_product on public.product_images(product_id);

-- 2. RLS: any authenticated user can read, only admin can write
alter table public.product_images enable row level security;

drop policy if exists product_images_select on public.product_images;
create policy product_images_select on public.product_images for select
  using (auth.uid() is not null);

drop policy if exists product_images_admin_write on public.product_images;
create policy product_images_admin_write on public.product_images for all
  using (public.is_admin()) with check (public.is_admin());

-- 3. Rebuild v_catalog with gallery array
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
