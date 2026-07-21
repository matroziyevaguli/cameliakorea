# `v_my_transfers` — add `product_id` · Run in Supabase SQL Editor

Adds **one column** so the Qaytarish page can group returns by `product_id` rather than by
name (G7 — renaming a product must never split its history into two rows). Additive
`create or replace`; **no data changes**, safe to re-run.

The page tolerates its absence — it falls back to grouping by product name until this runs —
so the code can ship first.

```sql
drop view if exists public.v_my_transfers;
create view public.v_my_transfers as
select
  t.id, t.qty, t.status, t.note, t.admin_note, t.created_at, t.resolved_at,
  t.from_seller_id, t.to_seller_id,
  t.product_id,                                    -- ← the only new column
  fp.full_name as from_name, tp.full_name as to_name, p.name as product_name,
  (t.from_seller_id = public.my_profile_id()) as is_outgoing
from public.transfers t
join public.profiles fp on fp.id = t.from_seller_id
join public.profiles tp on tp.id = t.to_seller_id
join public.products p  on p.id  = t.product_id
where t.from_seller_id = public.my_profile_id() or t.to_seller_id = public.my_profile_id()
order by t.created_at desc;
grant select on public.v_my_transfers to authenticated;
```

## Verify

```sql
-- product_id now present, one row per transfer involving me
select product_id, product_name, qty, status from public.v_my_transfers limit 5;
```

After it runs, the returns table groups strictly by product id (0 name fallbacks).
