# Ordering — Phase 0 foundations — Run in Supabase SQL Editor

Adds the two foundational pieces from `docs/ordering-and-survey-plan.md`:
**0a** seller payout data (card + default city) and **0b** product tags for the survey.
Additive and reversible — no existing data changes. Run the blocks in order; each is safe to re-run.

The admin UI for both ships with this phase (`/admin/sellers`, `/admin/products`) but stays
inert until these columns/tables exist.

---

## Block 1 — 0a · Seller card + default city (`profiles`)

```sql
alter table public.profiles
  add column if not exists city         text,   -- seller's default city (namangan/andijon/fargona/boshqa)
  add column if not exists card_number  text,   -- payout card shown to customers at checkout
  add column if not exists card_holder  text;   -- name printed on the card
```

## Block 2 — 0b · Product tags (`product_tags`)

```sql
create table if not exists public.product_tags (
  product_id uuid  not null references public.products(id) on delete cascade,
  tag_type   text  not null,                    -- 'skin_type' | 'concern'
  tag_value  text  not null,                    -- slug from src/consts/skincare.ts
  primary key (product_id, tag_type, tag_value)
);

create index if not exists idx_product_tags_lookup on public.product_tags(tag_type, tag_value);

alter table public.product_tags add constraint product_tags_type_check
  check (tag_type in ('skin_type','concern'));
```

## Block 3 — RLS

`product_tags` is read by the public survey (anon), written only by admins. Admin writes here go
through the browser client, so mirror however `products` is policed (admins can write).

```sql
alter table public.product_tags enable row level security;

-- Anyone may READ tags (the survey needs them with the anon key).
drop policy if exists product_tags_select on public.product_tags;
create policy product_tags_select on public.product_tags
  for select using (true);

-- Only admins may WRITE. Matches the products-write policy shape (adjust if yours differs).
drop policy if exists product_tags_write on public.product_tags;
create policy product_tags_write on public.product_tags
  for all
  using (exists (select 1 from public.profiles p
                  where p.user_id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p
                       where p.user_id = auth.uid() and p.role = 'admin'));
```

## Block 4 — Verify

```sql
-- columns exist
select column_name from information_schema.columns
 where table_name = 'profiles' and column_name in ('city','card_number','card_holder');

-- tag table + policies exist
select policyname from pg_policies where tablename = 'product_tags';
```

After this runs: set each active seller's card + city in **/admin/sellers**, then tag products in
**/admin/products** (skin type + concerns). Coverage check — products buyable but untagged are
invisible to the survey:

```sql
select p.id, p.name
  from public.products p
  left join public.product_tags t on t.product_id = p.id
 where p.discontinued_at is null and t.product_id is null;
```

---

## Rollback

```sql
drop table if exists public.product_tags;
alter table public.profiles
  drop column if exists city,
  drop column if exists card_number,
  drop column if exists card_holder;
```
