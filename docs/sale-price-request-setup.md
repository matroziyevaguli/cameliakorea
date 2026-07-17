# Sale price-change requests + Gulshan 50% — Run in Supabase SQL Editor

Lets a seller **request** a price correction on a sale she recorded wrong; you approve it from
**/admin/requests**. Quantity stays a direct edit; price is approval-gated because it changes
money. Also sets Gulshan's commission to 50%. See `docs/sale-price-request-plan.md`.

Paste the whole block → Run. Safe to re-run.

```sql
-- ── Table ─────────────────────────────────────────────────────────────
create table if not exists public.sale_price_requests (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references public.sales(id) on delete cascade,
  seller_id       uuid not null references public.profiles(id) on delete cascade,
  current_price   numeric not null,
  requested_price numeric not null check (requested_price >= 0),
  reason          text,
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note      text,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references public.profiles(id)
);
create index if not exists idx_spr_status on public.sale_price_requests(status);
create index if not exists idx_spr_seller on public.sale_price_requests(seller_id);
-- at most one open request per sale
create unique index if not exists uq_spr_open
  on public.sale_price_requests(sale_id) where status = 'pending';

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.sale_price_requests enable row level security;

drop policy if exists spr_select on public.sale_price_requests;
create policy spr_select on public.sale_price_requests for select
  using ( public.is_admin() or seller_id = public.my_profile_id() );

drop policy if exists spr_insert on public.sale_price_requests;
create policy spr_insert on public.sale_price_requests for insert
  with check ( public.is_admin() or seller_id = public.my_profile_id() );

-- only admin resolves; the price write happens server-side (service key) after approval
drop policy if exists spr_update on public.sale_price_requests;
create policy spr_update on public.sale_price_requests for update
  using ( public.is_admin() ) with check ( public.is_admin() );

drop policy if exists spr_delete on public.sale_price_requests;
create policy spr_delete on public.sale_price_requests for delete
  using ( public.is_admin() );

-- ── v_my_price_requests (seller-facing, definer) ──────────────────────
drop view if exists public.v_my_price_requests;
create view public.v_my_price_requests as
select
  r.id, r.sale_id, p.name as product_name, s.qty,
  r.current_price, r.requested_price, r.reason,
  r.status, r.admin_note, r.created_at, r.resolved_at
from public.sale_price_requests r
join public.sales s    on s.id = r.sale_id
join public.products p on p.id = s.product_id
where r.seller_id = public.my_profile_id()
order by r.created_at desc;
grant select on public.v_my_price_requests to authenticated;

-- ── v_sale_price_requests (admin-facing, invoker) ─────────────────────
drop view if exists public.v_sale_price_requests;
create view public.v_sale_price_requests with (security_invoker = on) as
select
  r.id, r.seller_id, pr.full_name as seller_name,
  r.sale_id, p.name as product_name, s.qty,
  r.current_price, r.requested_price, r.reason,
  r.status, r.admin_note, r.created_at, r.resolved_at
from public.sale_price_requests r
join public.profiles pr on pr.id = r.seller_id
join public.sales s     on s.id  = r.sale_id
join public.products p  on p.id  = s.product_id
order by (r.status = 'pending') desc, r.created_at desc;
grant select on public.v_sale_price_requests to authenticated;
```

## Also: Gulshan earns 50% (applies to all her sales, per your choice)

```sql
update public.profiles set commission_rate = 0.50 where full_name = 'GULSHAN';
```

(You can also change this any time in the admin **Sotuvchilar** screen — edit Gulshan → 50%.)
