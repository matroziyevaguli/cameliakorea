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
```sql
create or replace function public.check_no_oversell()
returns trigger language plpgsql as $$
declare
  allocated integer;
  already_sold integer;
begin
  select qty_allocated into allocated
    from public.allocations
    where seller_id = new.seller_id and product_id = new.product_id;

  if allocated is null then
    raise exception 'Bu mahsulot sizga biriktirilmagan';
  end if;

  select coalesce(sum(qty), 0) into already_sold
    from public.sales
    where seller_id = new.seller_id and product_id = new.product_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if already_sold + new.qty > allocated then
    raise exception 'Yetarli mahsulot yo''q: % ta bor, % ta sotilmoqchi',
      allocated - already_sold, new.qty;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_no_oversell on public.sales;
create trigger trg_no_oversell
  before insert or update on public.sales
  for each row execute function public.check_no_oversell();
```

## 3. Total allocated across sellers can't exceed a product's stock
```sql
create or replace function public.check_alloc_within_stock()
returns trigger language plpgsql as $$
declare
  total_alloc integer;
  stock integer;
begin
  select total_qty into stock from public.products where id = new.product_id;

  select coalesce(sum(qty_allocated), 0) into total_alloc
    from public.allocations
    where product_id = new.product_id and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if total_alloc + new.qty_allocated > stock then
    raise exception 'Taqsimot mahsulot sonidan oshib ketdi (jami: %, mavjud: %)', total_alloc + new.qty_allocated, stock;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_alloc_within_stock on public.allocations;
create trigger trg_alloc_within_stock
  before insert or update on public.allocations
  for each row execute function public.check_alloc_within_stock();
```

## Note
Run these one block at a time. If block 1 fails, some existing product has a discount
above retail — fix that product first, then re-run. Blocks 2 & 3 only affect *new*
sales/allocations, so they won't fail on existing data.
