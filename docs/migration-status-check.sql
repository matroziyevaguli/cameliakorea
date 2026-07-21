select 'D1 batch.status'        as item, (to_regclass('public.product_batches') is not null and exists (select 1 from information_schema.columns where table_name='product_batches' and column_name='status'))::text as ok
union all select 'D1 batch.unit_cost',   (exists (select 1 from information_schema.columns where table_name='product_batches' and column_name='unit_cost'))::text
union all select 'D2 trigger',           (exists (select 1 from pg_trigger where tgname='trg_batch_arrival'))::text
union all select 'D2 received_date nullable', (exists (select 1 from information_schema.columns where table_name='product_batches' and column_name='received_date' and is_nullable='YES'))::text
union all select 'D3 discontinued_at',   (exists (select 1 from information_schema.columns where table_name='products' and column_name='discontinued_at'))::text
union all select 'D4 v_product_availability', (to_regclass('public.v_product_availability') is not null)::text
union all select 'D5 v_shop.state',      (exists (select 1 from information_schema.columns where table_name='v_shop' and column_name='state'))::text
union all select 'D5 v_catalog.state',   (exists (select 1 from information_schema.columns where table_name='v_catalog' and column_name='state'))::text
union all select 'D7 sales.cancelled_at',(exists (select 1 from information_schema.columns where table_name='sales' and column_name='cancelled_at'))::text
union all select 'D7 sale_edits table',  (to_regclass('public.sale_edits') is not null)::text
union all select '— stock drift (must be 0)', coalesce((
    select count(*)::text from public.products p
    join public.v_product_availability a on a.product_id = p.id
    where a.received_qty <> p.total_qty), 'n/a — D4 not run')
union all select '— cost leak in v_shop (must be 0)', (
    select count(*)::text from information_schema.columns
    where table_name='v_shop' and column_name in ('cost','unit_cost','eta','soonest_eta'));
