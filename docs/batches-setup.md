# Product batches (partiyalar) — Run in Supabase SQL Editor

Lets you track **each shipment separately** so you can tell an older batch from a newer one,
give every batch its own **expiry date + lot label**, and see stock **FEFO** (first-expiring
first). Right-sized per `docs/research-batch-expiry.md`: batches are an independent expiry /
traceability layer — `products.total_qty` stays your stock number, batches don't change it.

Paste the whole block into SQL Editor → New query → Run. Safe to re-run.

```sql
-- ── Table ─────────────────────────────────────────────────────────────
create table if not exists public.product_batches (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  lot_label     text,                                   -- optional ("Iyul partiyasi", lot #)
  quantity      integer not null default 0 check (quantity >= 0),
  expiry_date   date,
  received_date date not null default current_date,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_batches_product on public.product_batches(product_id);
create index if not exists idx_batches_expiry  on public.product_batches(expiry_date);

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.product_batches enable row level security;

-- admin writes; any logged-in user can read (sellers may see batch/expiry info)
drop policy if exists batches_select on public.product_batches;
create policy batches_select on public.product_batches for select
  using ( auth.uid() is not null );
drop policy if exists batches_admin_write on public.product_batches;
create policy batches_admin_write on public.product_batches for all
  using ( public.is_admin() ) with check ( public.is_admin() );

-- ── v_batches (FEFO) ──────────────────────────────────────────────────
-- First-Expired-First-Out: earliest expiry first (nulls last), then oldest receipt.
drop view if exists public.v_batches;
create view public.v_batches with (security_invoker = on) as
select
  b.id, b.product_id, p.name as product_name,
  b.lot_label, b.quantity, b.expiry_date, b.received_date, b.note, b.created_at
from public.product_batches b
join public.products p on p.id = b.product_id
order by (b.expiry_date is null), b.expiry_date asc, b.received_date asc;
grant select on public.v_batches to authenticated;

-- ── v_batch_rollup (per-product summary) ──────────────────────────────
-- Total across batches + earliest expiry, so you can spot drift vs total_qty and
-- surface the soonest-expiring batch per product.
drop view if exists public.v_batch_rollup;
create view public.v_batch_rollup with (security_invoker = on) as
select
  p.id as product_id,
  p.name,
  p.total_qty,
  coalesce(sum(b.quantity), 0)              as batch_qty,
  min(b.expiry_date)                        as earliest_expiry,
  count(b.id)                               as batch_count
from public.products p
left join public.product_batches b on b.product_id = p.id
group by p.id, p.name, p.total_qty;
grant select on public.v_batch_rollup to authenticated;
```

After running this, a **Partiyalar** tab appears in the admin nav where you add a batch
(quantity + expiry + optional lot label) per product and see everything FEFO-sorted with
near-expiry badges.
