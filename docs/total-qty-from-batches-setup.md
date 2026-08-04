# Make `total_qty` derive from arrived batches — Run in Supabase SQL Editor

This is the never-built "Phase 3" from `availability_plan.md`: **`total_qty` stops being a
hand-edited number and becomes automatically derived from arrived partiyalar.**

## Why

Allocation/distribution runs on `products.total_qty` — both the Distribute page
(`total_qty − Σ allocations = bo'sh`) and the DB guard `check_alloc_within_stock`
(`Σ allocations ≤ total_qty`, see `db-guards.md`). But pressing **«Keldi»** only flips a
partiya to `arrived`; it never updates `total_qty`. So a product that arrives via «Keldi»
keeps `total_qty = 0`, shows "0 ta bo'sh" in Distribute, and the guard blocks every
allocation ("Taqsimot mahsulot sonidan oshib ketdi — mavjud: 0").

After this migration, any batch change (add / «Keldi» / edit / delete) recomputes
`total_qty = Σ arrived batches` for that product automatically. Distribute and the guard then
always see the real number, with zero app maintenance.

**Safe & reversible:** additive (one function + one trigger). Block 2 backfills every product
to its arrived sum — for products already in sync (all of them, after the one-time script
resync) it changes nothing.

Run the blocks in order. Each is safe to re-run.

---

## Block 1 — Function + trigger

```sql
create or replace function public.sync_total_qty_from_batches()
returns trigger
language plpgsql
as $fn$
declare
  v_pid uuid;
begin
  -- The product this batch belongs to (DELETE has no NEW; INSERT/UPDATE have NEW).
  v_pid := coalesce(new.product_id, old.product_id);

  update public.products p
     set total_qty = coalesce((
       select sum(b.quantity)
         from public.product_batches b
        where b.product_id = v_pid
          and b.status = 'arrived'
     ), 0)
   where p.id = v_pid;

  -- If a batch was moved to a different product, recompute the old product too.
  if tg_op = 'UPDATE' and new.product_id is distinct from old.product_id then
    update public.products p
       set total_qty = coalesce((
         select sum(b.quantity)
           from public.product_batches b
          where b.product_id = old.product_id
            and b.status = 'arrived'
       ), 0)
     where p.id = old.product_id;
  end if;

  return null;  -- AFTER trigger: return value is ignored
end;
$fn$;

drop trigger if exists trg_sync_total_qty on public.product_batches;
create trigger trg_sync_total_qty
  after insert or update or delete on public.product_batches
  for each row execute function public.sync_total_qty_from_batches();
```

Note: this fires **after** the existing `batch_arrival_sync` (a BEFORE trigger that stamps
`received_date`), so it always sees the final `status`.

## Block 2 — One-time backfill

```sql
update public.products p
   set total_qty = coalesce((
     select sum(b.quantity)
       from public.product_batches b
      where b.product_id = p.id
        and b.status = 'arrived'
   ), 0);
```

## Block 3 — Verify (expect 0 rows)

```sql
select p.id, p.name, p.total_qty,
       coalesce(sum(b.quantity) filter (where b.status = 'arrived'), 0) as arrived
  from public.products p
  left join public.product_batches b on b.product_id = p.id
 group by p.id, p.name, p.total_qty
having p.total_qty <> coalesce(sum(b.quantity) filter (where b.status = 'arrived'), 0);
```

---

## Rollback

```sql
drop trigger if exists trg_sync_total_qty on public.product_batches;
drop function if exists public.sync_total_qty_from_batches();
```

Removing the trigger just stops auto-updates; existing `total_qty` values stay as they are.
