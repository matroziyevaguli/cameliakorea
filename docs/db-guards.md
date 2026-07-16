# Database guards (P0 correctness) — Run in Supabase SQL Editor

These enforce the money/stock invariants at the database level, so even a bug, a direct
edit, or two phones racing on the last unit can't corrupt the data. The app already checks
these client-side; this is the real safety net.

## 1. Discount price can't exceed retail (and no negative prices)
```sql
alter table public.products
  add constraint chk_discount_le_retail
  check (discount_price is null or discount_price <= retail_price);

alter table public.products
  add constraint chk_prices_nonneg
  check (retail_price >= 0 and cost >= 0 and coalesce(discount_price, 0) >= 0);
```

## 2. A seller can never sell more than she was allocated (no overselling)
Prevents the "two phones sell the last unit" race — enforced atomically in the DB.
NOTE: uses a named `$fn$` tag (the Supabase editor mis-handles plain `$$`). Paste the
WHOLE block at once.
```sql
create or replace function public.check_no_oversell()
returns trigger
language plpgsql
as $fn$
declare
  v_allocated integer;
  v_sold integer;
begin
  select qty_allocated into v_allocated
    from public.allocations
    where seller_id = new.seller_id and product_id = new.product_id;

  if v_allocated is null then
    raise exception 'Bu mahsulot sizga biriktirilmagan';
  end if;

  select coalesce(sum(qty), 0) into v_sold
    from public.sales
    where seller_id = new.seller_id and product_id = new.product_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_sold + new.qty > v_allocated then
    raise exception 'Yetarli mahsulot yoq (mavjud: %, sotilmoqchi: %)', v_allocated - v_sold, new.qty;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_no_oversell on public.sales;
create trigger trg_no_oversell
  before insert or update on public.sales
  for each row execute function public.check_no_oversell();
```

## 3. Total allocated across sellers can't exceed a product's stock
```sql
create or replace function public.check_alloc_within_stock()
returns trigger
language plpgsql
as $fn$
declare
  v_total integer;
  v_stock integer;
begin
  select total_qty into v_stock from public.products where id = new.product_id;

  select coalesce(sum(qty_allocated), 0) into v_total
    from public.allocations
    where product_id = new.product_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if v_total + new.qty_allocated > v_stock then
    raise exception 'Taqsimot mahsulot sonidan oshib ketdi (jami: %, mavjud: %)', v_total + new.qty_allocated, v_stock;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_alloc_within_stock on public.allocations;
create trigger trg_alloc_within_stock
  before insert or update on public.allocations
  for each row execute function public.check_alloc_within_stock();
```

## Note
Run each block on its own. Block 1 fails only if an existing product has discount >
retail — fix that product first. Blocks 2 & 3 only affect *new* sales/allocations.
If the editor still complains about `$fn$`, paste ONLY the `create function … $fn$;`
part, run it, then run the `drop trigger … create trigger …` part separately.
