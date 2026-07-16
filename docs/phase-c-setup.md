# Phase C — Monthly statements + low-stock alerts

## 1. Add `revenue` to the monthly view (for the seller's statement)
Recreated as SECURITY DEFINER (no `security_invoker`) so sellers can read it.
```sql
drop view if exists public.v_my_monthly;
create view public.v_my_monthly as
select
  to_char(s.sold_at, 'YYYY-MM') as month,
  sum(s.qty) as units_sold,
  sum(s.qty * s.unit_price) as revenue,
  sum((s.qty * (s.unit_price - p.cost)) * pr.commission_rate) as your_profit
from public.sales s
join public.products p  on p.id  = s.product_id
join public.profiles pr on pr.id = s.seller_id
where s.seller_id = public.my_profile_id()
group by to_char(s.sold_at, 'YYYY-MM')
order by month;
```
(Returns net of returns automatically, since a return is a negative-qty sale.)

## 2. Low-stock Telegram alerts — env vars (set in `.env.local` AND Vercel)
Alerts go to YOU privately (not the public channel). You need your chat id with the bot:

**How to get your chat id:**
1. In Telegram, open your bot (@cameliakorea's bot) and press **Start** / send it any message.
2. Visit (in a browser): `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Find `"chat":{"id": 123456789 …}` — that number is your chat id.

Then add:
```
TELEGRAM_OWNER_CHAT_ID=123456789
LOW_STOCK_THRESHOLD=3
```
- If `TELEGRAM_OWNER_CHAT_ID` is unset, alerts are simply skipped (no error).
- You get a message when a product **crosses into low stock** (≤ threshold) and when it **sells out** — once per crossing, not on every sale.
