# Expiry tracking — Run in Supabase SQL Editor

Adds an expiry date to products so you can catch items before they go bad (a total loss
in skincare). No money-model change.

```sql
alter table public.products add column if not exists expiry_date date;
```

That's it. Set each product's expiry date in **/admin/products** (edit → "Yaroqlilik muddati").

## Optional: daily expiry report to your Telegram
The `/api/expiry-check` route sends you a summary of expired + soon-to-expire products.
You can trigger it from the Products page ("Muddat hisobotini yuborish"), or schedule it
daily later. It uses the same `TELEGRAM_OWNER_CHAT_ID` you set for low-stock alerts.
