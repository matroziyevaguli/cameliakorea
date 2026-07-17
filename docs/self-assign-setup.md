# Seller self-assignment — Run in Supabase SQL Editor

Phase 2 of the allocation requests: lets a seller request a product she **doesn't have yet**
(e.g. a newly-arrived batch). It creates a `new_product` request in your **So'rovlar** inbox;
approving it gives her that allocation. Uses the same `allocation_requests` table — run
`docs/allocation-requests-setup.md` first.

Paste into SQL Editor → New query → Run. Safe to re-run.

```sql
-- Products NOT yet allocated to the current seller — so she can request them.
-- SECURITY DEFINER (no security_invoker): sellers can't read `products` directly, so this
-- definer view exposes just the safe columns, filtered to what she lacks via my_profile_id().
drop view if exists public.v_available_products;
create view public.v_available_products as
select
  p.id, p.name, p.retail_price, p.discount_price, p.image_url
from public.products p
where not exists (
  select 1 from public.allocations a
  where a.product_id = p.id and a.seller_id = public.my_profile_id()
)
order by p.name;
grant select on public.v_available_products to authenticated;
```

Never exposes `cost` — sellers only see name + retail/discount price. Approving a request is
still guarded by the stock-cap trigger (can't allocate more than a product's stock).
