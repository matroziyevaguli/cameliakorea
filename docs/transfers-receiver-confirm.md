# Transfers → receiver confirms (not admin) — run in Supabase SQL Editor

Replaces the old `approve_transfer` so the **receiving seller** confirms a return (not the
admin). The move now runs server-side (service role) after the API verifies the caller is the
receiver. Safe to re-run.

```sql
-- New signature: (transfer id, who confirmed). Server-only execute.
create or replace function public.approve_transfer(p_id uuid, p_resolved_by uuid)
returns void language plpgsql security definer set search_path = public as $fn$
declare t public.transfers; v_remaining int;
begin
  select * into t from public.transfers where id = p_id and status = 'pending' for update;
  if not found then raise exception 'request not found or already handled'; end if;

  -- sender's remaining unsold = allocated - sold - adjusted (can't give back more than she holds)
  select a.qty_allocated
       - coalesce((select sum(qty) from public.sales            where seller_id = t.from_seller_id and product_id = t.product_id),0)
       - coalesce((select sum(qty) from public.stock_adjustments where seller_id = t.from_seller_id and product_id = t.product_id),0)
    into v_remaining
  from public.allocations a where a.seller_id = t.from_seller_id and a.product_id = t.product_id;

  if v_remaining is null or v_remaining < t.qty then
    raise exception 'sender does not have % unsold units', t.qty;
  end if;

  update public.allocations set qty_allocated = qty_allocated - t.qty
    where seller_id = t.from_seller_id and product_id = t.product_id;

  insert into public.allocations (seller_id, product_id, qty_allocated)
    values (t.to_seller_id, t.product_id, t.qty)
    on conflict (seller_id, product_id) do update
      set qty_allocated = public.allocations.qty_allocated + excluded.qty_allocated;

  update public.transfers set status='approved', resolved_at=now(), resolved_by=p_resolved_by where id = p_id;
end;
$fn$;

-- Only the server (service role) may call it; the API checks the caller is the receiver.
revoke all on function public.approve_transfer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_transfer(uuid, uuid) to service_role;

-- remove the old admin-only single-arg version
drop function if exists public.approve_transfer(uuid);
```
