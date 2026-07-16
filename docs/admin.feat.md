# Skincare Business Management — Full Build Spec

> **For Claude Code:** Read this whole file. It contains everything needed to build the
> feature: (1) the database to create in Supabase, and (2) the Next.js app to build.
> Do the database section first (or confirm it's already done), then build the app
> following the build order at the end. Build **one step at a time** and confirm each
> works before moving on.

---

## Part 1 — Database setup (Supabase)

Create a free project at https://supabase.com, open **SQL Editor → New query**, and run
the two scripts below **in order**. If the database is already set up, skip this part —
**do NOT recreate or migrate it**, just connect to it in Part 2.

### 1a. Schema — run this FIRST

```sql
-- =====================================================================
-- SKINCARE BUSINESS MANAGEMENT — SUPABASE SCHEMA
-- Run this FIRST in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Postgres / Supabase. Safe to re-run (drops are guarded).
-- =====================================================================

-- ---------- ENUM-ish roles via check constraints (simpler than enums) ----------

-- ---------------------------------------------------------------------
-- PROFILES
-- A "profile" is a business entity (you or a seller). It is linked to a
-- Supabase Auth user via user_id. We keep id and user_id SEPARATE so we
-- can seed sellers BEFORE they have login accounts, then link the auth
-- account later by setting user_id. Allocations/sales reference the
-- stable profile id, never the auth id.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references auth.users(id) on delete set null,
  full_name       text not null,
  role            text not null default 'seller' check (role in ('admin','seller')),
  commission_rate numeric not null default 0.40 check (commission_rate >= 0 and commission_rate <= 1),
  opening_balance numeric not null default 0,  -- debt owed at migration time (UZS)
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PRODUCTS  (all prices in UZS)
-- total_qty = total units you purchased in this batch.
-- Unallocated units = total_qty - sum of allocations for this product.
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  retail_price   numeric not null,
  discount_price numeric,            -- nullable: some products have no discount
  cost           numeric not null default 0,  -- wholesale per unit
  total_qty      integer not null default 0,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ALLOCATIONS  (which products, and how many, are assigned to a seller)
-- ---------------------------------------------------------------------
create table if not exists public.allocations (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.profiles(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  qty_allocated integer not null default 0 check (qty_allocated >= 0),
  created_at    timestamptz not null default now(),
  unique (seller_id, product_id)
);

-- ---------------------------------------------------------------------
-- SALES  (one row per sale a seller records)
-- unit_price = the actual price it sold at (retail, discount, or custom).
-- ---------------------------------------------------------------------
create table if not exists public.sales (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty        integer not null check (qty > 0),
  unit_price numeric not null check (unit_price >= 0),
  sold_at    timestamptz not null default now(),
  note       text
);

-- ---------------------------------------------------------------------
-- PAYMENTS  (cash you received from a seller — i.e. revenue minus their cut)
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id        uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  amount    numeric not null check (amount >= 0),
  paid_at   timestamptz not null default now(),
  note      text
);

create index if not exists idx_sales_seller   on public.sales(seller_id);
create index if not exists idx_sales_product  on public.sales(product_id);
create index if not exists idx_alloc_seller   on public.allocations(seller_id);
create index if not exists idx_pay_seller     on public.payments(seller_id);

-- =====================================================================
-- HELPER FUNCTIONS (security definer so they bypass RLS safely)
-- =====================================================================
create or replace function public.my_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid() limit 1
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  )
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- Sellers see/insert ONLY their own data. Admin sees/does everything.
-- =====================================================================
alter table public.profiles    enable row level security;
alter table public.products    enable row level security;
alter table public.allocations enable row level security;
alter table public.sales       enable row level security;
alter table public.payments    enable row level security;

-- PROFILES ------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using ( public.is_admin() or user_id = auth.uid() );

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles for all
  using ( public.is_admin() ) with check ( public.is_admin() );

-- PRODUCTS (everyone logged in can read; only admin can change) -------
drop policy if exists products_select on public.products;
create policy products_select on public.products for select
  using ( auth.uid() is not null );

drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products for all
  using ( public.is_admin() ) with check ( public.is_admin() );

-- ALLOCATIONS (seller reads own; admin manages) -----------------------
drop policy if exists alloc_select on public.allocations;
create policy alloc_select on public.allocations for select
  using ( public.is_admin() or seller_id = public.my_profile_id() );

drop policy if exists alloc_admin_write on public.allocations;
create policy alloc_admin_write on public.allocations for all
  using ( public.is_admin() ) with check ( public.is_admin() );

-- SALES (seller reads/creates/edits OWN; admin reads/edits all) --------
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales for select
  using ( public.is_admin() or seller_id = public.my_profile_id() );

drop policy if exists sales_insert on public.sales;
create policy sales_insert on public.sales for insert
  with check ( public.is_admin() or seller_id = public.my_profile_id() );

drop policy if exists sales_update on public.sales;
create policy sales_update on public.sales for update
  using ( public.is_admin() or seller_id = public.my_profile_id() )
  with check ( public.is_admin() or seller_id = public.my_profile_id() );

drop policy if exists sales_delete on public.sales;
create policy sales_delete on public.sales for delete
  using ( public.is_admin() or seller_id = public.my_profile_id() );

-- PAYMENTS (seller reads own; only admin records them) ----------------
drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments for select
  using ( public.is_admin() or seller_id = public.my_profile_id() );

drop policy if exists pay_admin_write on public.payments;
create policy pay_admin_write on public.payments for all
  using ( public.is_admin() ) with check ( public.is_admin() );

-- =====================================================================
-- REPORTING VIEWS  (security_invoker = on so RLS still filters per user)
-- =====================================================================

-- Per-sale economics: revenue, margin, your cut, seller cut, what they owe
drop view if exists public.v_sales_enriched;
create view public.v_sales_enriched with (security_invoker = on) as
select
  s.id,
  s.seller_id,
  pr.full_name                              as seller_name,
  s.product_id,
  p.name                                    as product_name,
  s.qty,
  s.unit_price,
  s.sold_at,
  (s.qty * s.unit_price)                    as revenue,
  (s.qty * p.cost)                          as cost_total,
  (s.qty * (s.unit_price - p.cost))         as margin,
  (s.qty * (s.unit_price - p.cost)) * pr.commission_rate            as seller_profit,
  (s.qty * (s.unit_price - p.cost)) * (1 - pr.commission_rate)      as my_profit,
  -- what the seller owes YOU on this sale = revenue minus their cut
  (s.qty * s.unit_price)
    - (s.qty * (s.unit_price - p.cost)) * pr.commission_rate        as owed_to_me
from public.sales s
join public.products p  on p.id  = s.product_id
join public.profiles pr on pr.id = s.seller_id;

-- Inventory remaining per seller per product
drop view if exists public.v_inventory;
create view public.v_inventory with (security_invoker = on) as
select
  a.seller_id,
  pr.full_name as seller_name,
  a.product_id,
  p.name       as product_name,
  a.qty_allocated,
  coalesce(sold.qty_sold, 0)                       as qty_sold,
  a.qty_allocated - coalesce(sold.qty_sold, 0)     as qty_remaining
from public.allocations a
join public.products p  on p.id  = a.product_id
join public.profiles pr on pr.id = a.seller_id
left join (
  select seller_id, product_id, sum(qty) as qty_sold
  from public.sales group by seller_id, product_id
) sold on sold.seller_id = a.seller_id and sold.product_id = a.product_id;

-- Per-seller running balance: opening debt + new owed - payments received
drop view if exists public.v_seller_balances;
create view public.v_seller_balances with (security_invoker = on) as
select
  pr.id                                            as seller_id,
  pr.full_name                                     as seller_name,
  pr.opening_balance,
  coalesce(sales_owed.owed, 0)                     as owed_from_sales,
  pr.opening_balance + coalesce(sales_owed.owed,0) as total_owed,
  coalesce(paid.received, 0)                       as received,
  pr.opening_balance + coalesce(sales_owed.owed,0) - coalesce(paid.received,0) as balance
from public.profiles pr
left join (
  select seller_id, sum(owed_to_me) as owed from public.v_sales_enriched group by seller_id
) sales_owed on sales_owed.seller_id = pr.id
left join (
  select seller_id, sum(amount) as received from public.payments group by seller_id
) paid on paid.seller_id = pr.id
where pr.role = 'seller';

-- Product performance (what's selling) — admin-facing
drop view if exists public.v_product_stats;
create view public.v_product_stats with (security_invoker = on) as
select
  p.id as product_id,
  p.name,
  p.total_qty,
  coalesce(sum(s.qty), 0)                        as units_sold,
  p.total_qty - coalesce(sum(s.qty), 0)          as units_remaining,
  coalesce(sum(s.qty * s.unit_price), 0)         as revenue
from public.products p
left join public.sales s on s.product_id = p.id
group by p.id, p.name, p.total_qty;

-- =====================================================================
-- DONE. Now run 02_seed.sql to load your products + sellers + stock.
-- =====================================================================
```

### 1b. Seed data — run this SECOND

```sql
-- =====================================================================
-- SKINCARE BUSINESS MANAGEMENT — SEED DATA
-- Run this SECOND, after 01_schema.sql.
-- Loads your real data from inventory.xlsx + kbeauty_pricing.xlsx.
--
-- Design choices baked in:
--   * Existing products are seeded at their CURRENT REMAINING stock,
--     and sales tracking starts fresh from today.
--   * Each seller's past debt is carried as opening_balance so you
--     don't lose what they owe (GULSHAN 3.6M / ADOLAT 1.6M / SAIDA 1.2M).
--   * Everyone is on a 40/60 split (commission_rate = 0.40).
--   * New batch (120 units) is loaded but NOT allocated — you distribute
--     it from the admin "Distribute" screen.
-- Fixed UUIDs are used so this is readable and re-runnable.
-- =====================================================================

-- ---------- PROFILES (you + 3 sellers) ----------
insert into public.profiles (id, full_name, role, commission_rate, opening_balance, active) values
  ('a0000000-0000-0000-0000-000000000001', 'Gulchiroy (Admin)', 'admin',  0.40, 0,         true),
  ('b0000000-0000-0000-0000-000000000001', 'GULSHAN',           'seller', 0.40, 3600711.2, true),
  ('b0000000-0000-0000-0000-000000000002', 'ADOLAT',            'seller', 0.40, 1645438,   true),
  ('b0000000-0000-0000-0000-000000000003', 'SAIDA',             'seller', 0.40, 1207371.2, true)
on conflict (id) do nothing;

-- ---------- PRODUCTS: existing line (total_qty = current remaining) ----------
-- NOTE: Snail creams have NO cost in your sheet -> seeded at 0. UPDATE THEM.
insert into public.products (id, name, retail_price, discount_price, cost, total_qty) values
  ('c0000000-0000-0000-0000-000000000001', 'Abib Sun Stick',                 250000, 180000, 56762,  10),
  ('c0000000-0000-0000-0000-000000000002', 'Roundlab SPF',                   160000, 160000, 111908, 4),
  ('c0000000-0000-0000-0000-000000000003', 'Nudy Spray',                     180000, 170000, 77972,  7),
  ('c0000000-0000-0000-0000-000000000004', 'Beauty of Joseon (old stock)',   230000, 180000, 107666, 8),
  ('c0000000-0000-0000-0000-000000000005', 'Aromatica Hair',                 200000, 170000, 86456,  11),
  ('c0000000-0000-0000-0000-000000000006', 'Aloe Krem',                      100000, 100000, 39794,  8),
  ('c0000000-0000-0000-0000-000000000007', 'Collagen',                       220000, 150000, 80787,  17),
  ('c0000000-0000-0000-0000-000000000008', 'Moisturising Snail Crem (Small)',130000, null,   0,      4),
  ('c0000000-0000-0000-0000-000000000009', 'Moisturising Snail Crem (Big)',  150000, null,   0,      5)
on conflict (id) do nothing;

-- ---------- PRODUCTS: NEW batch from kbeauty_pricing.xlsx (120 units) ----------
-- These have a single sell price (no discount). Allocate them via the app.
insert into public.products (id, name, retail_price, discount_price, cost, total_qty) values
  ('d0000000-0000-0000-0000-000000000001', '24K Gold to''plam (set)',          500000, null, 227812.5, 6),
  ('d0000000-0000-0000-0000-000000000002', 'Beauty of Joseon (new batch)',     120000, null, 77962.5,  15),
  ('d0000000-0000-0000-0000-000000000003', 'Medibue ko''z kremi (eye cream)',  150000, null, 69862.5,  15),
  ('d0000000-0000-0000-0000-000000000004', 'Bifida Night Care Ampula',         110000, null, 57631.5,  28),
  ('d0000000-0000-0000-0000-000000000005', 'Ultra Hydrating krem',             100000, null, 41431.5,  15),
  ('d0000000-0000-0000-0000-000000000006', 'Airy Tone-up quyosh kremi',        100000, null, 53581.5,  13),
  ('d0000000-0000-0000-0000-000000000007', 'UV Aqua Essence quyosh kremi',     80000,  null, 37381.5,  28)
on conflict (id) do nothing;

-- ---------- ALLOCATIONS: current remaining stock in each seller's hands ----------
-- (Zero-remaining lines are intentionally omitted.)

-- GULSHAN
insert into public.allocations (seller_id, product_id, qty_allocated) values
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001', 2),  -- Abib
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002', 1),  -- Roundlab
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000003', 3),  -- Nudy
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000005', 3),  -- Aromatica
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000006', 1),  -- Aloe
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000008', 4),  -- Snail S
  ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000009', 5)   -- Snail B
on conflict (seller_id, product_id) do nothing;

-- ADOLAT
insert into public.allocations (seller_id, product_id, qty_allocated) values
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001', 4),  -- Abib
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000002', 2),  -- Roundlab
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003', 1),  -- Nudy
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000004', 4),  -- Joseon
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000005', 3),  -- Aromatica
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000006', 3),  -- Aloe
  ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000007', 9)   -- Collagen
on conflict (seller_id, product_id) do nothing;

-- SAIDA
insert into public.allocations (seller_id, product_id, qty_allocated) values
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001', 4),  -- Abib
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002', 1),  -- Roundlab
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000003', 3),  -- Nudy
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004', 4),  -- Joseon
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000005', 5),  -- Aromatica
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000006', 4),  -- Aloe
  ('b0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000007', 8)   -- Collagen
on conflict (seller_id, product_id) do nothing;

-- =====================================================================
-- LINKING LOGIN ACCOUNTS  (do this AFTER the people sign up)
-- ---------------------------------------------------------------------
-- 1) You and each seller sign up (via the app's /login or Supabase
--    Dashboard → Authentication → Add user). This creates auth.users rows.
-- 2) Link each auth account to its profile by email. Run, editing emails:
--
--   update public.profiles set user_id = (select id from auth.users where email = 'you@example.com')
--     where id = 'a0000000-0000-0000-0000-000000000001';   -- you (admin)
--   update public.profiles set user_id = (select id from auth.users where email = 'gulshan@example.com')
--     where id = 'b0000000-0000-0000-0000-000000000001';
--   update public.profiles set user_id = (select id from auth.users where email = 'adolat@example.com')
--     where id = 'b0000000-0000-0000-0000-000000000002';
--   update public.profiles set user_id = (select id from auth.users where email = 'saida@example.com')
--     where id = 'b0000000-0000-0000-0000-000000000003';
--
-- IMPORTANT: link your OWN admin account first, or is_admin() returns
-- false for everyone and you'll be locked out by RLS.
-- =====================================================================

-- ---------- Quick sanity checks (optional) ----------
-- select * from public.v_seller_balances;
-- select * from public.v_inventory order by seller_name, product_name;
-- select * from public.v_product_stats order by units_remaining;
```

After running both, link login accounts as described in the commented section at the
bottom of the seed script (link the **admin account first**, or RLS locks everyone out).
Also: the Snail cream costs are seeded at `0` — update them once known.

---

## Part 2 — App build brief (Next.js)

## Context
This is an existing **Next.js portfolio** repo (`gulchiroy-portfolio`) using the
**pages router** (`src/pages`), **TypeScript**, and **Tailwind CSS**. I'm adding a
private business-management app for my small K-beauty reselling business. It must
live **behind authentication** under `/admin` (super admin = me) and `/seller`
(my sellers). **Do not modify or expose the public portfolio pages.**

The app's primary users are sellers using **phones**, so seller screens must be
**mobile-first**.

## IMPORTANT: the database already exists
A Supabase Postgres database is already set up with all tables, views, RLS
policies, and helper functions. **Do NOT create, migrate, or alter the schema.**
Just connect and query it. Schema reference files are in the repo:
`01_schema.sql` and `02_seed.sql` — read them to learn exact column names.

### Tables
- `profiles` — `id`, `user_id` (→ auth.users), `full_name`, `role` (`admin`|`seller`), `commission_rate` (default 0.40), `opening_balance`, `active`
- `products` — `id`, `name`, `retail_price`, `discount_price` (nullable), `cost`, `total_qty`
- `allocations` — `id`, `seller_id`, `product_id`, `qty_allocated`  (unique per seller+product)
- `sales` — `id`, `seller_id`, `product_id`, `qty`, `unit_price`, `sold_at`, `note`
- `payments` — `id`, `seller_id`, `amount`, `paid_at`, `note`

### Views (read from these for all reporting — never recompute math client-side)
- `v_sales_enriched` — per sale: `revenue`, `margin`, `seller_profit`, `my_profit`, `owed_to_me`
- `v_inventory` — per seller+product: `qty_allocated`, `qty_sold`, `qty_remaining`
- `v_seller_balances` — per seller: `opening_balance`, `owed_from_sales`, `total_owed`, `received`, `balance`
- `v_product_stats` — per product: `units_sold`, `units_remaining`, `revenue`

### Security model (already enforced by RLS — respect it, don't fight it)
- Sellers can only read/insert/edit **their own** sales, and read their own allocations/payments.
- Admin can do everything.
- Helper SQL functions exist: `is_admin()` and `my_profile_id()`.
- Use the **anon key** on the client (RLS protects data). Use the **service role
  key ONLY inside `src/pages/api/*` server routes**, never in client code.

## Tech to use
- `@supabase/supabase-js` + `@supabase/ssr` (the pages-router pattern: browser client,
  server client in `getServerSideProps`, and an API-route client).
- `recharts` for dashboard charts.
- Keep all amounts in **UZS**; format with thousands separators and a `so'm` suffix
  via one shared `formatUZS()` helper. No decimals shown to users.
- Do **not** use localStorage/sessionStorage for auth — use Supabase session cookies.

## Auth flow
- `/login` — email + password (Supabase Auth).
- After login, look up the user's `profiles.role`:
  - `admin` → redirect to `/admin`
  - `seller` → redirect to `/seller`
- Protect every `/admin/*` and `/seller/*` page in `getServerSideProps`: no session →
  redirect to `/login`; wrong role → redirect to their own area.

## Screens to build

### Admin (`/admin`) — me only
1. **Dashboard** — KPI cards (total revenue, my total profit, total outstanding across
   sellers) + a bar chart of best-selling products (`v_product_stats`) + recent sales
   feed (`v_sales_enriched`).
2. **Products** (`/admin/products`) — table of `products`; create/edit (name, retail_price,
   discount_price, cost, total_qty). This is where I add new product batches.
3. **Distribute** (`/admin/distribute`) — pick a product, see unallocated units
   (`total_qty` minus sum of allocations), assign quantities to each seller (upsert into
   `allocations`).
4. **Sellers** (`/admin/sellers`) — list profiles where role=seller; edit `commission_rate`,
   `active`. (Inviting users = an API route using the service role key.)
5. **Payments** (`/admin/payments`) — per seller show `v_seller_balances` (owed / received /
   balance); form to insert a `payments` row when a seller pays me.
6. **Stats** (`/admin/stats`) — `v_product_stats` + per-seller performance from
   `v_seller_balances` and `v_sales_enriched`.

### Seller (`/seller`) — each seller sees only her own data (RLS handles it)
1. **My products** (`/seller`) — `v_inventory` filtered to me: product, allocated, sold, remaining.
2. **Record a sale** (`/seller/sell`) — pick a product I have stock of, choose qty and price
   (preset buttons for retail / discount, plus custom), submit → insert into `sales`.
   **Block submitting qty greater than `qty_remaining`** (check `v_inventory` first).
3. **My sales** (`/seller/sales`) — my `sales` history with edit/delete on recent rows.
4. **My balance** (`/seller/balance`) — my row from `v_seller_balances`: how much I owe,
   what I've paid.

## Build order (do these one at a time, confirm each works before the next)
1. Supabase clients + env wiring (`.env.local`: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`).
2. `/login` + role-based redirect + route guards.
3. Seller **Record a sale** + **My products** (the most-used flow).
4. Admin **Dashboard**.
5. Admin **Distribute** + **Products**.
6. Admin **Payments** + **Stats**; Seller **My sales** + **My balance**.

## Constraints / don'ts
- Don't touch the public portfolio pages or its styling.
- Don't recreate or migrate the database.
- Don't put the service role key anywhere a browser can see it.
- Keep seller screens simple and mobile-first — big tap targets, minimal typing.