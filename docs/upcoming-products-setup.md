# Upcoming products ("Tez orada") — Run in Supabase SQL Editor

Adds a **separate** `upcoming_products` table for items that are announced but not yet
in stock. Kept out of `products` on purpose: upcoming items have no cost, no
`total_qty` and no allocations, so putting them in `products` would leak empty rows
into seller inventory, the distribute screen and every business metric.

```sql
-- 1. Table
create table if not exists public.upcoming_products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  image_url     text,                 -- same storage bucket as products
  teaser        text,                 -- short line, e.g. "Yangi kolleksiya"
  expected_note text,                 -- free text ETA: "Avgust oyida", "2 hafta ichida"
  sort_order    int  not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 2. RLS: anyone may read ACTIVE rows (the public landing page uses the anon key);
--    only admins may write.
alter table public.upcoming_products enable row level security;

drop policy if exists upcoming_public_select on public.upcoming_products;
create policy upcoming_public_select on public.upcoming_products
  for select to anon, authenticated
  using ( is_active );

drop policy if exists upcoming_admin_write on public.upcoming_products;
create policy upcoming_admin_write on public.upcoming_products
  for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

-- 3. Public view the landing page reads (mirrors the v_shop pattern)
drop view if exists public.v_upcoming;
create view public.v_upcoming with (security_invoker = on) as
select id, name, description, image_url, teaser, expected_note, sort_order
from public.upcoming_products
where is_active
order by sort_order asc, created_at desc;

grant select on public.v_upcoming to anon, authenticated;
```

## Seed a couple of rows to test

```sql
insert into public.upcoming_products (name, teaser, expected_note, image_url, sort_order)
values
  ('COSRX Snail Mucin Essence', 'Eng ko''p so''ralgan mahsulot', 'Avgust oyida', null, 1),
  ('Beauty of Joseon Sun Serum', 'Yangi kolleksiya',            'Sentabr oyida', null, 2);
```

## After running it
- `https://www.cameliakorea.com/` shows a **"Tez orada"** section under the catalog.
- If the table/view does not exist yet the section simply does not render — the page
  keeps working, so it is safe to deploy the code before running this SQL.
- Verify: `select * from public.v_upcoming;` should return the seeded rows.

## Managing rows
For now: insert/edit directly in the Supabase table editor. An admin UI can be added
later — it would be a thin CRUD page over the same table.
