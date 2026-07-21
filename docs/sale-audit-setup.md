# Sale cancellation + audit (D7) — Run in Supabase SQL Editor

Unblocks **G4** in `docs/redesign.md` §2: *"No hard deletes of sales. 'Delete' becomes
**Bekor qilingan** (cancelled/returned) with a reason and an audit row."*

## Why this is needed

Today the trust model is backwards:

- a seller may **hard-delete** one of her sales — the row is gone, no trace, nothing for
  you to review;
- but she must **ask your approval to correct a price** on that same sale.

Deletion is the far more destructive of the two. G4 makes it symmetric: she corrects her
own data freely, and **every** correction leaves a row you can see.

---

## Block 1 — Cancellation instead of deletion

```sql
alter table public.sales
  add column if not exists cancelled_at   timestamptz,
  add column if not exists cancel_reason  text;

create index if not exists idx_sales_cancelled on public.sales(cancelled_at);
```

Cancelled sales stay in the table but must stop counting as revenue, profit or stock
movement. **Every view that aggregates `sales` needs `where cancelled_at is null`** —
these are the ones in the repo:

| View | Used by |
|---|---|
| `v_my_sales` | seller Sotuvlarim, sell-flow profit |
| `v_my_summary` | seller Hisobim + home strip |
| `v_my_monthly` | seller chart + monthly statement |
| `v_my_inventory` | seller stock counts |
| `v_sales_enriched` | admin dashboard, payments, seller detail |
| `v_product_stats` | admin stats |
| `v_seller_balances` | admin payments, stats |
| `v_inventory` | admin distribute |
| `v_shop` / `v_product_availability` | storefront `remaining` |

> ⚠ **Do not run Block 1 on its own.** Until every view above filters cancelled rows, a
> "cancelled" sale still counts as sold. Add the filter to each view in the same session
> — I can generate the exact `create or replace view` statements once you paste me the
> current definitions (`select pg_get_viewdef('public.v_my_sales', true);` etc.), since
> they were built up across many docs and I don't want to guess at their current shape.

## Block 2 — The audit trail

```sql
create table if not exists public.sale_edits (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales(id) on delete cascade,
  editor_id   uuid not null references public.profiles(id),
  action      text not null check (action in ('qty','price','cancel','restore')),
  old_value   numeric,
  new_value   numeric,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_sale_edits_sale on public.sale_edits(sale_id);
create index if not exists idx_sale_edits_at   on public.sale_edits(created_at desc);

alter table public.sale_edits enable row level security;

-- A seller sees her own edits; the admin sees everything.
drop policy if exists sale_edits_select on public.sale_edits;
create policy sale_edits_select on public.sale_edits for select
  using ( public.is_admin() or editor_id = public.my_profile_id() );

-- Anyone may WRITE their own audit row; nobody may rewrite history.
drop policy if exists sale_edits_insert on public.sale_edits;
create policy sale_edits_insert on public.sale_edits for insert
  with check ( editor_id = public.my_profile_id() or public.is_admin() );
-- deliberately NO update/delete policy → audit rows are append-only
```

## Block 3 — Let a seller fix her own price

Today `sales.unit_price` is admin-only, which is why the price-request flow exists.
G4 says she may correct her own sale directly, because the audit row makes it visible.

```sql
-- Check what the current policy allows before changing it:
select polname, pg_get_expr(polqual, polrelid) as using_expr,
       pg_get_expr(polwithcheck, polrelid)     as check_expr
from pg_policy where polrelid = 'public.sales'::regclass;
```

If `sales_update` already covers `seller_id = public.my_profile_id()` then no change is
needed — the column is writable and only the UI was gating it.

## Block 4 — Verify

```sql
-- Audit rows cannot be edited or deleted (expect: permission denied both times)
update public.sale_edits set reason = 'x' where id = (select id from public.sale_edits limit 1);
delete from public.sale_edits where id = (select id from public.sale_edits limit 1);

-- A cancelled sale must vanish from revenue (run after the view filters are in)
-- 1. note a seller's total, 2. cancel one sale, 3. confirm the total dropped by its amount
 
```

---

## What ships once this is run

- **Sotuvlarim**: the trash icon becomes **"Bekor qilingan deb belgilash"** with reason
  chips (*Qaytardi* / *Xato yozdim*). The row stays, greyed, with a **Bekor qilingan**
  chip — the same treatment returns already get.
- **Price editing moves inline**, next to quantity. The
  `sale_price_requests` flow can then be retired (or kept for a transition period).
- **Admin** gets a per-sale edit history, so "she changed something" is answerable
  instead of invisible.

I'd suggest running `docs/availability-migration-setup.md` **first** — it's fully
additive and changes no existing view, whereas this one rewrites nine of them.
