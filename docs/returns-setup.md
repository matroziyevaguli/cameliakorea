# Returns + Audit trail — Run in Supabase SQL Editor

Enables **returns** (a customer brings an item back) and an **audit log** (deletions are
recorded, never silent). A return is stored as a `sales` row with **negative qty**, so every
existing view (revenue, profit, stock, balances) reconciles automatically — no view changes.

## 1. Allow negative quantity (so a return can be recorded)
```sql
alter table public.sales drop constraint if exists sales_qty_check;
alter table public.sales add constraint sales_qty_nonzero check (qty <> 0);
```

## 2. Audit log — record every deletion automatically (DB-side, nothing to change in the app)
```sql
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null,
  action      text not null,
  record_id   uuid,
  detail      jsonb,
  actor       uuid,
  created_at  timestamptz not null default now()
);

alter table public.audit_log enable row level security;

drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select using ( public.is_admin() );
```

```sql
create or replace function public.log_delete()
returns trigger
language plpgsql
security definer
as $fn$
begin
  insert into public.audit_log(table_name, action, record_id, detail, actor)
  values (tg_table_name, 'delete', old.id, to_jsonb(old), auth.uid());
  return old;
end;
$fn$;

drop trigger if exists trg_log_sales_delete on public.sales;
create trigger trg_log_sales_delete
  before delete on public.sales
  for each row execute function public.log_delete();

drop trigger if exists trg_log_payments_delete on public.payments;
create trigger trg_log_payments_delete
  before delete on public.payments
  for each row execute function public.log_delete();
```

## 3. (Only if you already ran the no-oversell trigger) — make sure it ignores returns
Returns have negative qty, so they always pass the oversell check. No change needed —
but if you want to be explicit, the guard already handles it (a negative qty only lowers
the sold total).

## Note
- A **return** is inserted by the app as `{ qty: -N, unit_price: <original> }`. Nothing
  is deleted, so history stays honest and balances self-correct.
- **Deletions** (genuine mistakes) still work, but now every deleted `sales`/`payments`
  row is copied into `audit_log` first — you can always see what was removed.
