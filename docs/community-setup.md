# Community / Q&A — Run in Supabase SQL Editor

Table for the public Q&A board (`docs/community-prd.md`). Public (anon) can read **only answered**
questions; submissions and moderation go through server APIs with the service role, so anon can't
insert or edit. Additive & reversible.

---

## Block 1 — Table

```sql
create table if not exists public.community_questions (
  id          uuid primary key default gen_random_uuid(),
  name        text,                       -- optional display name; null → "Anonim"
  question    text not null,
  answer      text,                       -- null until answered
  topic       text,                       -- slug from src/consts/community.ts
  status      text not null default 'pending',
  ip_hash     text,                       -- hashed submitter IP, for rate-limiting only (not raw IP)
  created_at  timestamptz not null default now(),
  answered_at timestamptz
);
-- If the table already existed without ip_hash, add it:
alter table public.community_questions add column if not exists ip_hash text;

alter table public.community_questions drop constraint if exists community_questions_status_check;
alter table public.community_questions add constraint community_questions_status_check
  check (status in ('pending','answered','hidden'));

create index if not exists idx_cq_public on public.community_questions(status, answered_at desc);
create index if not exists idx_cq_ratelimit on public.community_questions(ip_hash, created_at desc);
```

## Block 2 — RLS

```sql
alter table public.community_questions enable row level security;

-- Public may READ only answered questions (the browse list, anon key).
drop policy if exists community_public_read on public.community_questions;
create policy community_public_read on public.community_questions
  for select using (status = 'answered');

-- Admin manages everything (server side / admin session). Submits + moderation also use the
-- service role, which bypasses RLS entirely.
drop policy if exists community_admin_all on public.community_questions;
create policy community_admin_all on public.community_questions
  for all
  using (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin'));
```

## Verify
```sql
select policyname from pg_policies where tablename = 'community_questions';
select count(*) from public.community_questions;
```

## Rollback
```sql
drop table if exists public.community_questions;
```
