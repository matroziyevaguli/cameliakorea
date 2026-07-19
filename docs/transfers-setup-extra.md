# Transfers — extra views (run AFTER `transfersandgiveawayssetup.md` Part B2)

These display views let the seller pick a recipient and let both sides see transfer status
without reading RLS-blocked base tables. Run in Supabase SQL Editor. Safe to re-run.

```sql
-- Active seller names, so a seller can pick who to return units to (definer — sellers can't
-- read `profiles` directly). Names aren't secret (already shown in Telegram captions).
drop view if exists public.v_seller_names;
create view public.v_seller_names as
select id, full_name from public.profiles where role = 'seller' and active = true order by full_name;
grant select on public.v_seller_names to authenticated;

-- Seller-facing: my transfers (sent or received) with names + product (definer).
drop view if exists public.v_my_transfers;
create view public.v_my_transfers as
select
  t.id, t.qty, t.status, t.note, t.admin_note, t.created_at, t.resolved_at,
  t.from_seller_id, t.to_seller_id,
  fp.full_name as from_name, tp.full_name as to_name, p.name as product_name,
  (t.from_seller_id = public.my_profile_id()) as is_outgoing
from public.transfers t
join public.profiles fp on fp.id = t.from_seller_id
join public.profiles tp on tp.id = t.to_seller_id
join public.products p  on p.id  = t.product_id
where t.from_seller_id = public.my_profile_id() or t.to_seller_id = public.my_profile_id()
order by t.created_at desc;
grant select on public.v_my_transfers to authenticated;

-- Admin-facing: all transfers with names + product (invoker → only admin sees all).
drop view if exists public.v_transfers;
create view public.v_transfers with (security_invoker = on) as
select
  t.id, t.qty, t.status, t.note, t.admin_note, t.created_at, t.resolved_at,
  fp.full_name as from_name, tp.full_name as to_name, p.name as product_name
from public.transfers t
join public.profiles fp on fp.id = t.from_seller_id
join public.profiles tp on tp.id = t.to_seller_id
join public.products p  on p.id  = t.product_id
order by (t.status = 'pending') desc, t.created_at desc;
grant select on public.v_transfers to authenticated;
```
