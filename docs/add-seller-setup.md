# Add/Edit seller — Run in Supabase SQL Editor

Lets the **login page list sellers dynamically** (so a newly-added seller appears in the
dropdown automatically). Exposes only active seller **names** — the login builds the email
from the name (`name → name@sellers.local`), so no emails are published.

```sql
drop view if exists public.v_login_sellers;
create view public.v_login_sellers as
  select full_name
  from public.profiles
  where role = 'seller' and active = true
  order by full_name;

grant select on public.v_login_sellers to anon, authenticated;
```

## How it works
- **Add seller** (admin UI → /admin/sellers): creates a login account (`name@sellers.local`
  + the password you set) AND the profile (commission %, opening debt) in one step, via the
  `/api/create-seller` route (service-role, admin-only).
- The seller can log in immediately by picking their name and entering that password, and can
  change the password later in **Sozlamalar**.
- **Edit seller**: name, commission %, opening debt, active — all from the admin UI.
