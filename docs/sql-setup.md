# SQL Setup Guide

Go to https://supabase.com/dashboard/project/pabkwjvsxvdqzklozjnn → **SQL Editor** → **New query**

---

## Script 1 — Run this FIRST (Schema)

Paste this entire block, click **Run**, wait for success.

```sql
create table if not exists public.profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references auth.users(id) on delete set null,
  full_name       text not null,
  role            text not null default 'seller' check (role in ('admin','seller')),
  commission_rate numeric not null default 0.40 check (commission_rate >= 0 and commission_rate <= 1),
  opening_balance numeric not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  retail_price   numeric not null,
  discount_price numeric,
  cost           numeric not null default 0,
  total_qty      integer not null default 0,
  created_at     timestamptz not null default now()
);
create table if not exists public.allocations (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.profiles(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  qty_allocated integer not null default 0 check (qty_allocated >= 0),
  created_at    timestamptz not null default now(),
  unique (seller_id, product_id)
);
create table if not exists public.sales (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty        integer not null check (qty > 0),
  unit_price numeric not null check (unit_price >= 0),
  sold_at    timestamptz not null default now(),
  note       text
);
create table if not exists public.payments (
  id        uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  amount    numeric not null check (amount >= 0),
  paid_at   timestamptz not null default now(),
  note      text
);
create index if not exists idx_sales_seller  on public.sales(seller_id);
create index if not exists idx_sales_product on public.sales(product_id);
create index if not exists idx_alloc_seller  on public.allocations(seller_id);
create index if not exists idx_pay_seller    on public.payments(seller_id);
create or replace function public.my_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid() limit 1
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin')
$$;
alter table public.profiles    enable row level security;
alter table public.products    enable row level security;
alter table public.allocations enable row level security;
alter table public.sales       enable row level security;
alter table public.payments    enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using ( public.is_admin() or user_id = auth.uid() );
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all using ( public.is_admin() ) with check ( public.is_admin() );
drop policy if exists products_select on public.products;
create policy products_select on public.products for select using ( auth.uid() is not null );
drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products for all using ( public.is_admin() ) with check ( public.is_admin() );
drop policy if exists alloc_select on public.allocations;
create policy alloc_select on public.allocations for select using ( public.is_admin() or seller_id = public.my_profile_id() );
drop policy if exists alloc_admin_write on public.allocations;
create policy alloc_admin_write on public.allocations for all using ( public.is_admin() ) with check ( public.is_admin() );
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales for select using ( public.is_admin() or seller_id = public.my_profile_id() );
drop policy if exists sales_insert on public.sales;
create policy sales_insert on public.sales for insert with check ( public.is_admin() or seller_id = public.my_profile_id() );
drop policy if exists sales_update on public.sales;
create policy sales_update on public.sales for update using ( public.is_admin() or seller_id = public.my_profile_id() ) with check ( public.is_admin() or seller_id = public.my_profile_id() );
drop policy if exists sales_delete on public.sales;
create policy sales_delete on public.sales for delete using ( public.is_admin() or seller_id = public.my_profile_id() );
drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments for select using ( public.is_admin() or seller_id = public.my_profile_id() );
drop policy if exists pay_admin_write on public.payments;
create policy pay_admin_write on public.payments for all using ( public.is_admin() ) with check ( public.is_admin() );
drop view if exists public.v_sales_enriched;
create view public.v_sales_enriched with (security_invoker = on) as
select s.id, s.seller_id, pr.full_name as seller_name, s.product_id, p.name as product_name,
  s.qty, s.unit_price, s.sold_at,
  (s.qty * s.unit_price) as revenue,
  (s.qty * p.cost) as cost_total,
  (s.qty * (s.unit_price - p.cost)) as margin,
  (s.qty * (s.unit_price - p.cost)) * pr.commission_rate as seller_profit,
  (s.qty * (s.unit_price - p.cost)) * (1 - pr.commission_rate) as my_profit,
  (s.qty * s.unit_price) - (s.qty * (s.unit_price - p.cost)) * pr.commission_rate as owed_to_me
from public.sales s
join public.products p on p.id = s.product_id
join public.profiles pr on pr.id = s.seller_id;
drop view if exists public.v_inventory;
create view public.v_inventory with (security_invoker = on) as
select a.seller_id, pr.full_name as seller_name, a.product_id, p.name as product_name,
  a.qty_allocated, coalesce(sold.qty_sold, 0) as qty_sold,
  a.qty_allocated - coalesce(sold.qty_sold, 0) as qty_remaining
from public.allocations a
join public.products p on p.id = a.product_id
join public.profiles pr on pr.id = a.seller_id
left join (
  select seller_id, product_id, sum(qty) as qty_sold
  from public.sales group by seller_id, product_id
) sold on sold.seller_id = a.seller_id and sold.product_id = a.product_id;
drop view if exists public.v_seller_balances;
create view public.v_seller_balances with (security_invoker = on) as
select pr.id as seller_id, pr.full_name as seller_name, pr.opening_balance,
  coalesce(sales_owed.owed, 0) as owed_from_sales,
  pr.opening_balance + coalesce(sales_owed.owed, 0) as total_owed,
  coalesce(paid.received, 0) as received,
  pr.opening_balance + coalesce(sales_owed.owed, 0) - coalesce(paid.received, 0) as balance
from public.profiles pr
left join (
  select seller_id, sum(owed_to_me) as owed from public.v_sales_enriched group by seller_id
) sales_owed on sales_owed.seller_id = pr.id
left join (
  select seller_id, sum(amount) as received from public.payments group by seller_id
) paid on paid.seller_id = pr.id
where pr.role = 'seller';
drop view if exists public.v_product_stats;
create view public.v_product_stats with (security_invoker = on) as
select p.id as product_id, p.name, p.total_qty,
  coalesce(sum(s.qty), 0) as units_sold,
  p.total_qty - coalesce(sum(s.qty), 0) as units_remaining,
  coalesce(sum(s.qty * s.unit_price), 0) as revenue
from public.products p
left join public.sales s on s.product_id = p.id
group by p.id, p.name, p.total_qty;
```

---

## Script 2 — Run this SECOND (Seed data)

New query → paste this → click **Run**.

```sql
insert into public.profiles (id, full_name, role, commission_rate, opening_balance, active) values
  ('a0000000-0000-0000-0000-000000000001', 'Gulchiroy (Admin)', 'admin',  0.40, 0,         true),
  ('b0000000-0000-0000-0000-000000000001', 'GULSHAN',           'seller', 0.40, 3600711.2, true),
  ('b0000000-0000-0000-0000-000000000002', 'ADOLAT',            'seller', 0.40, 1645438,   true),
  ('b0000000-0000-0000-0000-000000000003', 'SAIDA',             'seller', 0.40, 1207371.2, true)
on conflict (id) do nothing;

insert into public.products (id, name, retail_price, discount_price, cost, total_qty) values
  ('c0000000-0000-0000-0000-000000000001', 'Abib Sun Stick',                  250000, 180000, 56762,     10),
  ('c0000000-0000-0000-0000-000000000002', 'Roundlab SPF',                    160000, 160000, 111908,    4),
  ('c0000000-0000-0000-0000-000000000003', 'Nudy Spray',                      180000, 170000, 77972,     7),
  ('c0000000-0000-0000-0000-000000000004', 'Beauty of Joseon (old stock)',    230000, 180000, 107666,    8),
  ('c0000000-0000-0000-0000-000000000005', 'Aromatica Hair',                  200000, 170000, 86456,     11),
  ('c0000000-0000-0000-0000-000000000006', 'Aloe Krem',                       100000, 100000, 39794,     8),
  ('c0000000-0000-0000-0000-000000000007', 'Collagen',                        220000, 150000, 80787,     17),
  ('c0000000-0000-0000-0000-000000000008', 'Moisturising Snail Crem (Small)', 130000, null,   0,         4),
  ('c0000000-0000-0000-0000-000000000009', 'Moisturising Snail Crem (Big)',   150000, null,   0,         5),
  ('d0000000-0000-0000-0000-000000000001', '24K Gold toplam (set)',           500000, null,   227812.5,  6),
  ('d0000000-0000-0000-0000-000000000002', 'Beauty of Joseon (new batch)',    120000, null,   77962.5,   15),
  ('d0000000-0000-0000-0000-000000000003', 'Medibue ko''z kremi (eye cream)', 150000, null,   69862.5,   15),
  ('d0000000-0000-0000-0000-000000000004', 'Bifida Night Care Ampula',        110000, null,   57631.5,   28),
  ('d0000000-0000-0000-0000-000000000005', 'Ultra Hydrating krem',            100000, null,   41431.5,   15),
  ('d0000000-0000-0000-0000-000000000006', 'Airy Tone-up quyosh kremi',       100000, null,   53581.5,   13),
  ('d0000000-0000-0000-0000-000000000007', 'UV Aqua Essence quyosh kremi',    80000,  null,   37381.5,   28)
on conflict (id) do nothing;

insert into public.allocations (seller_id, product_id, qty_allocated) values
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001', 2),
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002', 1),
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000003', 3),
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000005', 3),
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000006', 1),
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000008', 4),
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000009', 5),
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001', 4),
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002', 2),
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003', 1),
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000004', 4),
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000005', 3),
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000006', 3),
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000007', 9),
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001', 4),
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002', 1),
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003', 3),
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004', 4),
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000005', 5),
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000006', 4),
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000007', 8)
on conflict (seller_id, product_id) do nothing;
```

---

## Script 3 — Link your admin account (run AFTER creating your login)

After you sign up at `/login`, run this in SQL Editor (your email is already filled in):

```sql
update public.profiles
set user_id = (select id from auth.users where email = 'javohir.manchester@gmail.com')
where id = 'a0000000-0000-0000-0000-000000000001';
```
