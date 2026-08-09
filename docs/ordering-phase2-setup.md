# Ordering — Phase 2 (cart + checkout + orders) — Run in Supabase SQL Editor

Adds the order tables + a private receipts bucket. Customer operations go through server API
routes using the **service role** (which bypasses RLS), so RLS here only needs to let **admins**
read/manage orders. Customers never touch these tables directly. Additive & reversible.

Also required (one-time, outside SQL): in **BotFather**, set the bot domain so the Telegram Login
widget works — `/setdomain` → your site's domain (e.g. `camelia.uz`). And ensure env has
`TELEGRAM_BOT_TOKEN` (already present) and `NEXT_PUBLIC_TELEGRAM_BOT` (the bot @username).

---

## Block 1 — Customers

```sql
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  telegram_id   text unique,
  full_name     text,
  phone         text,
  email         text,
  session_token uuid,                       -- opaque bearer stored in an httpOnly cookie
  created_at    timestamptz not null default now()
);
create index if not exists idx_customers_session on public.customers(session_token);
```

## Block 2 — Orders + items

```sql
create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid references public.customers(id),
  status             text not null default 'pending_payment',
  city               text not null,
  address            text not null,
  contact_name       text not null,
  contact_phone      text not null,
  assigned_seller_id uuid references public.profiles(id),
  subtotal           numeric not null,
  receipt_url        text,
  rejection_reason   text,
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  paid_at            timestamptz,
  confirmed_at       timestamptz,
  delivered_at       timestamptz
);
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'pending_payment','awaiting_confirmation','awaiting_payment_retry',
  'confirmed','delivering','delivered','cancelled','rejected'));

create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_assigned on public.orders(assigned_seller_id);
create index if not exists idx_orders_customer on public.orders(customer_id);

create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  product_id   uuid not null references public.products(id),
  product_name text not null,
  unit_price   numeric not null,
  qty          integer not null check (qty > 0)
);
create index if not exists idx_order_items_order on public.order_items(order_id);
```

## Block 3 — `updated_at` trigger

```sql
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_orders_touch on public.orders;
create trigger trg_orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
```

## Block 4 — RLS (admins manage; customers use the service-role API)

```sql
alter table public.customers   enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- helper predicate: current auth user is an admin
-- (inline it since Postgres policies can't take params)
drop policy if exists orders_admin on public.orders;
create policy orders_admin on public.orders for all
  using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin'));

drop policy if exists order_items_admin on public.order_items;
create policy order_items_admin on public.order_items for all
  using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin'));

drop policy if exists customers_admin on public.customers;
create policy customers_admin on public.customers for select
  using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin'));
```
(No anon/customer policies — customer reads/writes run through server API routes with the service
role, which bypasses RLS. Sellers get their own read policy in Phase 4.)

## Block 5 — Receipts bucket (private)

```sql
insert into storage.buckets (id, name, public)
values ('order-receipts', 'order-receipts', false)
on conflict (id) do nothing;
```
Uploads + admin views happen server-side with the service role (signed URLs), so no bucket
policies are needed for the anon key.

---

## Verify
```sql
select table_name from information_schema.tables
 where table_name in ('customers','orders','order_items');
select id, public from storage.buckets where id = 'order-receipts';
```

## Rollback
```sql
drop table if exists public.order_items;
drop table if exists public.orders;
drop table if exists public.customers;
delete from storage.buckets where id = 'order-receipts';
```
