# Allocation correction requests — Run in Supabase SQL Editor

Lets a **seller** flag that the quantity you entered for her is wrong ("you gave me 4, I
actually have 3"). The request lands in your **/admin/requests** inbox; when you approve, her
allocation is corrected (never below what she's already sold). Nothing changes stock until you
approve. See `docs/allocation-requests-plan.md` for the full design.

Paste the whole block into SQL Editor → New query → Run. Safe to re-run.

```sql
-- ── Table ─────────────────────────────────────────────────────────────
create table if not exists public.allocation_requests (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.profiles(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  type          text not null default 'correction' check (type in ('correction','new_product')),
  current_qty   integer not null default 0,                 -- what the system showed when she asked
  requested_qty integer not null check (requested_qty >= 0),-- the true count she claims
  reason        text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note    text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.profiles(id)
);
create index if not exists idx_alloc_req_status on public.allocation_requests(status);
create index if not exists idx_alloc_req_seller on public.allocation_requests(seller_id);

-- At most ONE open request per (seller, product, type) — keeps the inbox clean.
create unique index if not exists uq_alloc_req_open
  on public.allocation_requests(seller_id, product_id, type)
  where status = 'pending';

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.allocation_requests enable row level security;

-- seller reads & creates her OWN; admin reads all
drop policy if exists alloc_req_select on public.allocation_requests;
create policy alloc_req_select on public.allocation_requests for select
  using ( public.is_admin() or seller_id = public.my_profile_id() );

drop policy if exists alloc_req_insert on public.allocation_requests;
create policy alloc_req_insert on public.allocation_requests for insert
  with check ( public.is_admin() or seller_id = public.my_profile_id() );

-- ONLY admin resolves (approve/reject). Sellers can never change status or apply stock.
drop policy if exists alloc_req_update on public.allocation_requests;
create policy alloc_req_update on public.allocation_requests for update
  using ( public.is_admin() ) with check ( public.is_admin() );

drop policy if exists alloc_req_delete on public.allocation_requests;
create policy alloc_req_delete on public.allocation_requests for delete
  using ( public.is_admin() );

-- ── v_my_requests (seller-facing) ─────────────────────────────────────
-- SECURITY DEFINER (no security_invoker) so a seller — who can't read `products` —
-- can still see her own requests with the product name. Filtered to her by my_profile_id().
drop view if exists public.v_my_requests;
create view public.v_my_requests as
select
  r.id, r.product_id, p.name as product_name, r.type,
  r.current_qty, r.requested_qty, r.reason, r.status, r.admin_note,
  r.created_at, r.resolved_at
from public.allocation_requests r
join public.products p on p.id = r.product_id
where r.seller_id = public.my_profile_id()
order by r.created_at desc;
grant select on public.v_my_requests to authenticated;

-- ── v_allocation_requests (admin-facing) ──────────────────────────────
-- security_invoker: only an admin sees all rows (RLS above). Adds seller/product names,
-- the CURRENT allocation, and how many she's already sold (the floor an approval can't cross).
drop view if exists public.v_allocation_requests;
create view public.v_allocation_requests with (security_invoker = on) as
select
  r.id, r.seller_id, pr.full_name as seller_name,
  r.product_id, p.name as product_name,
  r.type, r.current_qty, r.requested_qty, r.reason,
  r.status, r.admin_note, r.created_at, r.resolved_at,
  coalesce(alloc.qty_allocated, 0) as qty_allocated_now,
  coalesce(sold.qty_sold, 0)       as qty_sold
from public.allocation_requests r
join public.profiles pr on pr.id = r.seller_id
join public.products p  on p.id  = r.product_id
left join public.allocations alloc
  on alloc.seller_id = r.seller_id and alloc.product_id = r.product_id
left join (
  select seller_id, product_id, sum(qty) as qty_sold
  from public.sales group by seller_id, product_id
) sold on sold.seller_id = r.seller_id and sold.product_id = r.product_id
order by (r.status = 'pending') desc, r.created_at desc;
grant select on public.v_allocation_requests to authenticated;
```

After running this, the seller's **Mahsulotlar** cards get a "Sonini tuzatish" button, and you
get a **So'rovlar** tab in the admin nav.
