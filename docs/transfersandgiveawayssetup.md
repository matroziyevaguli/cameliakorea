# Returns-between-sellers + Giveaways — Solution & Setup

> Two real operations Camelia needs:
> 1. **Return / transfer** — a seller has **unsold** units and hands them back to **Gulshan**
>    (the main seller), or to any other seller. The app must move the stock between them —
>    cleanly, with no money owed (nothing was sold).
> 2. **Giveaways** — Camelia gives skincare away **free** on Telegram/Instagram. Those units
>    must **leave stock** but create **no revenue and no debt**, and there should be a
>    **section** to record them (product, who won, which channel).
>
> **The good news:** your database already has the right tools. This doc explains the
> solution, gives the exact SQL to run in Supabase, and specifies the app screens.
> Run the SQL first, then the app changes.

---

## Part A — The idea in one picture

```
                 ALLOCATIONS (who holds what)              STOCK LEAVES (no money)
                 ───────────────────────────              ───────────────────────
 Admin ──gives──► Seller A ──sells──► money + owes        stock_adjustments:
                    │                                        • damaged / lost
                    └──RETURNS unsold──► Gulshan (main)       • gift
                        = TRANSFER: move N from A→Gulshan      • GIVEAWAY  ◄── new
                          (no sale, no debt)                 (removes units, NO revenue/debt)
```

- A **return** never touches money — the units were unsold, so it's purely an allocation move.
- A **giveaway** is a `stock_adjustments` row (reason `giveaway`): your stock views already
  subtract adjustments, so `remaining` drops and **no money is affected** (it's marketing cost,
  which the business absorbs — the seller owes nothing for a giveaway).

Everything below reuses tables you already have (`allocations`, `stock_adjustments`,
`allocation_requests` pattern). Money math (the `v_*` views) is **not changed**.

---

## Part B — SQL to run in Supabase (both features)

### B1. Giveaways — extend `stock_adjustments`

A giveaway is already representable as a stock adjustment; we just add the reason and two
optional fields for the record (winner + channel).

```sql
-- allow 'giveaway' as a reason
alter table public.stock_adjustments drop constraint if exists stock_adjustments_reason_check;
alter table public.stock_adjustments
  add constraint stock_adjustments_reason_check
  check (reason in ('damaged','lost','gift','giveaway','other'));

-- who won it + where it was run (nullable; only used for giveaways)
alter table public.stock_adjustments add column if not exists winner  text;
alter table public.stock_adjustments add column if not exists channel text;   -- 'telegram' | 'instagram' | 'other'
```

That's it — the existing `v_my_inventory` / `v_inventory` / `v_admin_seller_products` views
already subtract every `stock_adjustments` row, so a giveaway immediately lowers `remaining`
with **zero** effect on revenue, profit, or balances.

### B2. Returns / transfers — new `transfers` table + an atomic move function

```sql
-- A request to move UNSOLD units from one seller to another (usually → the main seller).
create table if not exists public.transfers (
  id             uuid primary key default gen_random_uuid(),
  from_seller_id uuid not null references public.profiles(id) on delete cascade,
  to_seller_id   uuid not null references public.profiles(id) on delete cascade,
  product_id     uuid not null references public.products(id) on delete cascade,
  qty            integer not null check (qty > 0),
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  note           text,
  admin_note     text,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    uuid references public.profiles(id)
);
alter table public.transfers enable row level security;

-- Seller can create a transfer FROM herself, and read her own (in or out). Admin sees all.
drop policy if exists transfers_select on public.transfers;
create policy transfers_select on public.transfers for select using (
  public.is_admin() or from_seller_id = public.my_profile_id() or to_seller_id = public.my_profile_id()
);
drop policy if exists transfers_insert on public.transfers;
create policy transfers_insert on public.transfers for insert with check (
  public.is_admin() or from_seller_id = public.my_profile_id()
);
drop policy if exists transfers_admin_update on public.transfers;
create policy transfers_admin_update on public.transfers for update using ( public.is_admin() ) with check ( public.is_admin() );

-- Atomic approve: check the sender still has enough UNSOLD units, then move the allocation.
create or replace function public.approve_transfer(p_id uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare t public.transfers; v_remaining int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select * into t from public.transfers where id = p_id and status = 'pending' for update;
  if not found then raise exception 'request not found or already handled'; end if;

  -- sender's remaining = allocated - sold - adjusted  (must be >= qty to give back)
  select a.qty_allocated
       - coalesce((select sum(qty) from public.sales where seller_id = t.from_seller_id and product_id = t.product_id),0)
       - coalesce((select sum(qty) from public.stock_adjustments where seller_id = t.from_seller_id and product_id = t.product_id),0)
    into v_remaining
  from public.allocations a where a.seller_id = t.from_seller_id and a.product_id = t.product_id;

  if v_remaining is null or v_remaining < t.qty then
    raise exception 'sender does not have % unsold units', t.qty;
  end if;

  -- decrement sender
  update public.allocations set qty_allocated = qty_allocated - t.qty
    where seller_id = t.from_seller_id and product_id = t.product_id;

  -- increment receiver (create the row if she has none yet)
  insert into public.allocations (seller_id, product_id, qty_allocated)
    values (t.to_seller_id, t.product_id, t.qty)
    on conflict (seller_id, product_id) do update set qty_allocated = public.allocations.qty_allocated + excluded.qty_allocated;

  update public.transfers set status='approved', resolved_at=now(), resolved_by=public.my_profile_id() where id = p_id;
end;
$fn$;
```

> Total allocated stays constant and `total_qty` never changes, so the product-stock cap is
> never violated by a transfer. The sender can never give back more than she actually has
> unsold (`allocated − sold − adjusted`).

### B3. (optional) A tidy view for the admin giveaways list

```sql
drop view if exists public.v_giveaways;
create view public.v_giveaways with (security_invoker = on) as
select adj.id, adj.created_at, adj.qty, adj.winner, adj.channel, adj.note,
       p.name as product_name, pr.full_name as seller_name
from public.stock_adjustments adj
join public.products p  on p.id  = adj.product_id
left join public.profiles pr on pr.id = adj.seller_id
where adj.reason = 'giveaway'
order by adj.created_at desc;
```

---

## Part C — App screens

### C1. Giveaways (admin) — **built in this change**
`/admin/giveaways` (+ a "Sovg'alar" nav item):
- **Record a giveaway:** product · from which seller's stock (usually Gulshan) · qty ·
  winner (name / @handle) · channel (Telegram / Instagram / Other) · note → inserts a
  `stock_adjustments` row (`reason='giveaway'`). Stock drops automatically; no money moves.
- **List** of past giveaways (date · product · from · qty · winner · channel).
- *Later:* a "Post to Telegram" button reusing `/api/announce` to announce the giveaway.

### C2. Returns / transfers — spec to build next
- **Seller app** (`/seller`): on a product, a **"♻️ Qaytarish"** action → choose qty (≤ her
  remaining) + recipient (default: the main seller) → `POST /api/transfer-request`
  (mirror `allocation-request.ts`) inserts a `transfers` row and pings the owner on Telegram.
- **Admin app** (`/admin/requests` or a Transfers tab): pending transfers with **Approve /
  Reject**. Approve calls `POST /api/resolve-transfer` → `supabase.rpc('approve_transfer',{p_id})`.
- **Main seller (Gulshan)** simply sees her allocation for that product go **up** once approved;
  the sender's goes **down**. No money for anyone (unsold units).

> Want it even simpler for the admin? Because a transfer is just "reduce A, increase B", the
> admin can already do it today on **/admin/distribute** by hand. The `transfers` flow above
> adds the seller-initiated request + an audit record + the safety that she can't return more
> than she holds.

---

## Part D — Guardrails (unchanged rules)
- A **return/transfer never touches money** — unsold units only; no sale, no debt.
- A **giveaway never creates revenue or debt** — it's a `stock_adjustments` (marketing cost).
- Sellers still never see `cost`/margin/owner-profit.
- Never let a seller give back or give away more than her **remaining** (`allocated − sold −
  adjusted`); the `approve_transfer` function enforces this.
- Money math stays in the `v_*` views — none of this changes them.

## Part E — Verify
- Record a giveaway of 2 units from Gulshan → her `remaining` drops by 2; revenue/owed unchanged.
- Seller A (remaining 5) returns 3 to Gulshan → after approve: A −3, Gulshan +3; totals match;
  `select * from v_inventory where qty_remaining < 0;` returns 0 rows.
- A can't return 10 when she only holds 5 → blocked with a clear message.
