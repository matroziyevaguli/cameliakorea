# Ordering — Phase 3 (confirm → seller sale) — Run in Supabase SQL Editor

One atomic function turns a paid online order into the assigned seller's sale, keeping stock,
allocations and balances consistent with the rest of the system (plan §4.4). Because it's a
single plpgsql function, either **all** of it happens or **none** — no half-allocated sellers.

The admin Orders page calls it via `service_role` after verifying the caller is an admin.

---

## Block 1 — `confirm_order(uuid)`

```sql
create or replace function public.confirm_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order  public.orders%rowtype;
  v_seller uuid;
  it       record;
  v_avail  int;
  v_alloc  int;
  v_sold   int;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Buyurtma topilmadi'; end if;
  if v_order.status not in ('awaiting_confirmation','pending_payment','awaiting_payment_retry','rejected') then
    raise exception 'Buyurtma holati mos emas (%)', v_order.status;
  end if;

  v_seller := v_order.assigned_seller_id;
  if v_seller is null then raise exception 'Sotuvchi tayinlanmagan'; end if;

  for it in select * from public.order_items where order_id = p_order_id loop
    -- Business-wide availability = arrived − sold (v_product_availability).
    select remaining into v_avail from public.v_product_availability where product_id = it.product_id;
    if coalesce(v_avail, 0) < it.qty then
      raise exception 'Yetarli mahsulot yo''q: % (kerak %, bor %)', it.product_name, it.qty, coalesce(v_avail, 0);
    end if;

    -- Ensure the seller's allocation covers sold+this (qty_allocated >= qty_sold + qty),
    -- so the no-oversell trigger passes when we insert the sale.
    select qty_allocated into v_alloc from public.allocations where seller_id = v_seller and product_id = it.product_id;
    select coalesce(sum(qty), 0) into v_sold from public.sales
      where seller_id = v_seller and product_id = it.product_id and cancelled_at is null;

    if v_alloc is null then
      insert into public.allocations(seller_id, product_id, qty_allocated) values (v_seller, it.product_id, v_sold + it.qty);
    elsif v_alloc < v_sold + it.qty then
      update public.allocations set qty_allocated = v_sold + it.qty where seller_id = v_seller and product_id = it.product_id;
    end if;

    insert into public.sales(seller_id, product_id, qty, unit_price, sold_at, note)
      values (v_seller, it.product_id, it.qty, it.unit_price, now(), 'onlayn buyurtma');
  end loop;

  update public.orders set status = 'confirmed', confirmed_at = now() where id = p_order_id;
end $$;

grant execute on function public.confirm_order(uuid) to service_role;
```

Notes:
- If the seller's allocation bump would exceed the product's stock, the existing
  `check_alloc_within_stock` guard raises — the whole confirm fails cleanly and the admin must
  add a partiya or reassign. Nothing is left half-applied.
- Reassigning **after** confirm (reversing the sale) is Phase 4; assign before confirming.

## Verify
```sql
select proname from pg_proc where proname = 'confirm_order';
```

## Rollback
```sql
drop function if exists public.confirm_order(uuid);
```
