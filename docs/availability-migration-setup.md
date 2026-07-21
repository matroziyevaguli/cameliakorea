# Availability migration (D1–D5) — Run in Supabase SQL Editor

Implements `docs/availability_plan.md` §2 and §8 steps 1–2. **Additive and reversible:**
after running it, every existing number is unchanged and no screen looks different. It
only *adds* the shipment lifecycle the UI will start reading in Phases 2 and 4.

Run the blocks **in order**. Each is safe to re-run.

---

## ⚠ One deviation from the plan — read this first

`availability_plan.md` §4 says to `create or replace view v_catalog` as the public,
anon-readable storefront view.

**That name is already taken.** `v_catalog` is the *seller-facing definer view* and is
read by three pages — `seller/index.tsx`, `seller/sell.tsx`, `seller/sales.tsx` — because
`products` RLS returns zero rows to sellers. Replacing it with the plan's definition
would **break the seller app**.

The actual public storefront view is **`v_shop`** (`docs/public-shop-view.md`), read by
`pages/index.tsx` and `pages/product/[id].tsx` with the anon key.

**So:** this migration puts `state` on **`v_shop`** (public) and *also* adds it to
`v_catalog` (sellers), keeping both names doing the job they already do. Everything else
follows the plan exactly.

---

## Block 1 — D1 · Batch lifecycle columns

```sql
alter table public.product_batches
  add column if not exists status       text,
  add column if not exists ordered_date date,
  add column if not exists eta          date,
  add column if not exists unit_cost    numeric;

-- Existing rows are real, landed stock.
update public.product_batches set status = 'arrived' where status is null;

alter table public.product_batches alter column status set default 'arrived';
alter table public.product_batches alter column status set not null;

alter table public.product_batches drop constraint if exists product_batches_status_check;
alter table public.product_batches add constraint product_batches_status_check
  check (status in ('ordered','in_transit','arrived','cancelled'));

create index if not exists idx_batches_status on public.product_batches(status);
```

## Block 2 — D2 · The arrival invariant

`received_date` is currently `not null default current_date`, which makes an
*ordered-but-not-here* batch impossible to represent. Relax it, then let a trigger
enforce **`status = 'arrived'` ⇔ `received_date IS NOT NULL`**.

```sql
alter table public.product_batches alter column received_date drop not null;
alter table public.product_batches alter column received_date drop default;

create or replace function public.batch_arrival_sync() returns trigger
language plpgsql as $$
begin
  if new.status = 'arrived' then
    -- flipping to arrived stamps today unless a date was given
    if new.received_date is null then new.received_date := current_date; end if;
  else
    -- not arrived ⇒ cannot carry an arrival date
    new.received_date := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_batch_arrival on public.product_batches;
create trigger trg_batch_arrival
  before insert or update on public.product_batches
  for each row execute function public.batch_arrival_sync();

-- Backfill: any arrived row missing a date gets its creation date.
update public.product_batches
   set received_date = created_at::date
 where status = 'arrived' and received_date is null;
```

## Block 3 — D3 · Discontinued flag

```sql
alter table public.products add column if not exists discontinued_at timestamptz;
```

## Block 4 — D4 · `v_product_availability` (the `state` enum)

Definer view (no `security_invoker`) so the public views can build on it.

**Migration safety:** while `total_qty` is still the hand-edited source of truth, a
product with **no batch rows** falls back to `total_qty`. So on day one `received_qty`
equals today's stock for every SKU and **`remaining` does not move**. Constraint §6.1
of the plan is met by construction.

```sql
drop view if exists public.v_product_availability cascade;

create view public.v_product_availability as
with batch_agg as (
  select
    product_id,
    coalesce(sum(quantity) filter (where status = 'arrived'), 0)                 as received_qty,
    coalesce(sum(quantity) filter (where status in ('ordered','in_transit')), 0) as incoming_qty,
    max(received_date) filter (where status = 'arrived')                         as last_arrival,
    min(eta)           filter (where status in ('ordered','in_transit'))         as soonest_eta
  from public.product_batches
  group by product_id
),
sold as (
  select product_id, coalesce(sum(qty), 0) as units_sold
  from public.sales
  group by product_id
),
base as (
  select
    p.id                                as product_id,
    p.discontinued_at,
    case when coalesce(b.received_qty, 0) > 0
         then b.received_qty
         else p.total_qty end           as received_qty,   -- fallback until Phase 5
    coalesce(b.incoming_qty, 0)         as incoming_qty,
    b.last_arrival,
    b.soonest_eta,
    coalesce(s.units_sold, 0)           as units_sold
  from public.products p
  left join batch_agg b on b.product_id = p.id
  left join sold      s on s.product_id = p.id
)
select
  product_id,
  received_qty,
  incoming_qty,
  last_arrival,
  soonest_eta,                                       -- INTERNAL: never expose publicly
  greatest(received_qty - units_sold, 0) as remaining,
  case
    when discontinued_at is not null                            then 'discontinued'
    when received_qty = 0 and incoming_qty > 0                  then 'not_arrived'
    when received_qty - units_sold <= 0 and incoming_qty > 0     then 'sold_out_incoming'
    when received_qty - units_sold <= 0                          then 'sold_out'
    when received_qty - units_sold <= 2                          then 'low'
    else                                                              'in_stock'
  end as state,
  -- "Keldi ✅" flourish: newest arrival within 3 days (plan §4)
  (last_arrival is not null and last_arrival >= current_date - 3) as just_arrived
from base;

grant select on public.v_product_availability to anon, authenticated;
```

The `low` threshold is **2**, matching today's orange badge (`RemainingBadge`, `n <= 2`).

## Block 5 — D5 · Public `v_shop` gains `state`

Keeps every column the storefront already selects, so nothing breaks mid-deploy.
**No `cost`, no `unit_cost`, no `eta`** — verify with Block 7.

```sql
drop view if exists public.v_shop;

create view public.v_shop as
select
  p.id,
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
  ) as gallery,
  a.remaining,
  a.state,
  (a.state in ('in_stock','low')) as buyable,
  (a.incoming_qty > 0)            as restock_coming,
  a.just_arrived
from public.products p
join public.v_product_availability a on a.product_id = p.id
where p.discontinued_at is null;          -- discontinued drop out of the catalog

grant select on public.v_shop to anon, authenticated;
```

## Block 6 — Seller `v_catalog` gains `state`

So the seller card shows the **same** signal the customer sees.
**Must stay a definer view** (no `security_invoker`) — sellers cannot read `products`
directly, and making it an invoker view returns zero rows and blanks their whole app.

```sql
drop view if exists public.v_catalog;

create view public.v_catalog as
select
  p.id,
  p.name,
  p.retail_price,
  p.discount_price,
  p.image_url,
  p.description,
  p.link,
  p.expiry_date,
  coalesce(
    (select json_agg(pi.url order by pi.sort_order asc)
     from public.product_images pi
     where pi.product_id = p.id),
    '[]'::json
  ) as gallery,
  a.state,
  a.incoming_qty,
  a.just_arrived
from public.products p
join public.v_product_availability a on a.product_id = p.id;

grant select on public.v_catalog to anon, authenticated;
```

## Block 7 — Verify before trusting it

```sql
-- 1. Stock must NOT have moved. Compare old vs new for every SKU — expect 0 rows.
select p.id, p.name, p.total_qty, a.received_qty
from public.products p
join public.v_product_availability a on a.product_id = p.id
where a.received_qty <> p.total_qty;

-- 2. Eyeball the state of all ~16 SKUs against reality (plan §9, step 2).
select p.name, a.received_qty, a.incoming_qty, a.remaining, a.state
from public.v_product_availability a
join public.products p on p.id = a.product_id
order by a.state, p.name;

-- 3. No cost leaks to the public view. Expect 0 rows.
select column_name from information_schema.columns
where table_name = 'v_shop' and column_name in ('cost','unit_cost','eta','soonest_eta');

-- 4. The invariant holds. Expect 0 rows.
select id, status, received_date from public.product_batches
where (status = 'arrived') <> (received_date is not null);
```

Then, still as the **anon** key (not service role), confirm the storefront reads:
`select id, name, state, buyable, restock_coming from public.v_shop limit 5;`

## Try the new lifecycle

```sql
-- Announce a product that hasn't landed (plan §5): a batch with no arrival.
insert into public.product_batches (product_id, quantity, status, eta, unit_cost)
values ('<product-uuid>', 30, 'ordered', current_date + 21, 42000);
-- → that product's state becomes 'not_arrived' (or 'sold_out_incoming' if it had 0 left)

-- It lands — the one action:
update public.product_batches set status = 'arrived' where id = '<batch-uuid>';
-- → received_date stamped automatically; stock appears; state flips to 'in_stock'
```

---

## Rollback

```sql
drop view if exists public.v_product_availability cascade;   -- also drops dependent views
-- then re-run docs/public-shop-view.md (v_shop) and docs/seller-expiry-setup.md (v_catalog)
drop trigger if exists trg_batch_arrival on public.product_batches;
drop function if exists public.batch_arrival_sync();
-- columns can stay; they are unused without the views
```

## After this runs
Tell me and I'll ship **Phase 2** (card badges read `state`, `Tez orada` retired) and
**Phase 4** (Partiyalar gets `[+ Partiya]` with a status and the one-tap `[Keldi]`).
Until then the app ignores these columns entirely and behaves exactly as today.
