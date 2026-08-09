# Camelia — Customer (Xaridor) experience — Plan

How the **user/customer** side works, page by page, so improvements are deliberate rather than
ad-hoc. Separate from the admin/seller apps. Auth = Telegram login → httpOnly session cookie
(`lib/customerAuth`). Cart = localStorage (`lib/cart`), anonymous until checkout.

---

## 1. Personas in the header

The landing header must reflect **who is looking**:

| State | Header shows | Notes |
|---|---|---|
| **Logged out** | `[Telegram] [Kirish ▾]` | "Kirish" menu = Telegram customer login + "Admin sifatida" + "Sotuvchi sifatida". |
| **Customer logged in** | `[🛒 cart] [Ism ▾]` | **No "Kirish"**. Name menu = Mening buyurtmalarim · Chiqish (+ a small "Boshqa rol bilan kirish" → /login for staff). |

**Fix (this iteration):** when a customer is logged in, replace the "Kirish" button with their
**name**, and add a **cart icon with a count badge** in the header. Admin/seller can still reach
`/login` from the footer link and the name-menu's staff link.

---

## 2. Pages (customer-facing)

### `/` — Landing / catalog
- Hero → **"Teringizga mos mahsulotni toping"** (survey) + "Katalogni ko'rish".
- Product grid from `v_shop` (state badges via `lib/availability`).
- Header account + cart per §1.
- *Improve:* header cart; logged-in name; (later) category filter chips using `products.category`.

### `/tavsiya` — Skincare survey
- 2 steps (skin type → concerns ≤3) → ranked recommendations.
- *Improve:* add **"Savatga qo'sh" directly on result cards** (today they only link to the product);
  keep the "why it fits" line.

### `/product/[id]` — Product detail
- Gallery, price, state badge, description, **Savatga qo'shish** (+ Telegram fallback).
- *Improve:* quantity selector before adding; show category + "shu teri turi uchun" tag chips.

### `/savat` — Cart + checkout
- Cart editor (qty steppers, remove, total).
- Login gate (Telegram) → city + address + contact → create order → redirect to status.
- *Improve:* if logged in already, skip the login card; show a compact "kim uchun" summary; inline
  stock/price re-check message if a line changed.

### `/buyurtma/[id]` — Order status + payment
- Status banner, **CardPreview** (Uzcard/Humo) + amount, receipt upload / re-upload, items, address.
- Owner-checked (only the buyer sees it).
- *Improve:* copy-card-number button; clearer "keyingi qadam" line per status.

### `/buyurtmalarim` — My orders
- List of the customer's orders (status + total) → each opens its status page.
- *Improve:* filter tabs (faol / yakunlangan) once volume grows.

---

## 3. Cross-cutting

- **Cart persistence:** localStorage; survives navigation; syncs across tabs. No server cart (login
  only attaches identity at order time — no surprise merges).
- **Empty / error states:** every page has an empty state (cart, my-orders) and surfaces API errors
  in Uzbek.
- **Mobile-first:** all customer pages are single-column, thumb-reachable actions.
- **Auth boundary:** customer session is separate from Supabase Auth (admin/seller). Customer
  order reads/writes go through service-role API routes checked by the session cookie.

---

## 4. Improvement backlog (prioritized)

1. **Header logged-in state** — hide "Kirish"/popup when a customer is logged in; show name + cart. ← *doing now*
2. Add-to-cart on survey result cards + storefront cards (quick-add).
3. Quantity selector on the product page.
4. Copy-card-number button on the payment screen.
5. Category filter chips on the landing page.
6. My-orders filter tabs.

Each item ships in the build-and-log rhythm; `docs/ordering-build-log.md` records what lands.
