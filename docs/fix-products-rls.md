# Fix: sellers can't read the products table (RLS drift) — Run in Supabase SQL Editor

## The bug
The `products` table's SELECT policy drifted so that **sellers get 0 rows**. Because
`v_sales_enriched`, `v_inventory`, and `v_seller_balances` all use `security_invoker = on`
and join `products`, they **cascade to 0 / wrong values for sellers**. Symptom: the seller
`/seller/balance` page showed **balance = 0** even when the seller owed millions.

The app code now works around this (seller pages read the definer views `v_my_summary`,
`v_my_inventory`, `v_catalog`). But you should still restore the policy so the underlying
views are correct everywhere and this can't bite again.

## The fix (one policy)
```sql
-- Any logged-in user may READ products (prices are not secret; RLS still blocks writes).
-- cost is a column, not a secret at the row level — seller-facing VIEWS omit it, which is
-- the correct place to hide it. Do NOT expose cost in any seller view.
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select
  using ( auth.uid() is not null );
```

## Verify after running
```sql
-- As a seller these should now return rows (test via the app, logged in as a seller):
--   select count(*) from v_sales_enriched;   -- > 0
--   select balance from v_seller_balances;   -- matches v_my_summary.not_submitted
```
Or just log into the app as `gulshan@sellers.local` and open **Hisobim** — the numbers
should match what the admin sees on the Payments page.
