# Sale price-change requests + Gulshan 50/50 commission — Plan

Two things:
- **Part A** — a seller can **request** to fix the *price* of a sale she recorded wrong. Unlike
  quantity (which she edits directly), price changes **money owed + profit split**, so it goes
  through **admin approval** — same "verify, don't blind-trust" spine as the allocation
  corrections ([[allocation-requests-plan]]).
- **Part B** — Gulshan earns **50%** of profit (she's the main seller); everyone else stays 40%.

---

## Part A — Seller requests a price correction on a sale

### 0. Why a request (not a direct edit)
Quantity is the seller's own count and is guarded by the oversell trigger, so she edits it
directly. **Price is different** — it changes `revenue`, `margin`, `seller_profit`, and
`owed_to_me` for that sale. The owner must see and approve any price change. So: **qty = direct,
price = request → approve.**

### 1. Data model — `sale_price_requests`
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `sale_id` | uuid → sales (on delete cascade) | the sale to fix |
| `seller_id` | uuid → profiles | requester (must own the sale) |
| `current_price` | numeric | unit_price at request time (context) |
| `requested_price` | numeric ≥ 0 | the corrected unit price |
| `reason` | text | "chegirma bilan sotdim", etc. |
| `status` | text | pending / approved / rejected |
| `admin_note` | text | admin's reply |
| `created_at` / `resolved_at` / `resolved_by` | | audit |

- **One open request per sale**: partial unique index on `(sale_id) where status='pending'`.
- Dedicated table (not reusing `allocation_requests`) because the domain differs — a *sale* +
  *price*, vs an *allocation* + *quantity*. Keeps both models clean. (Alternative: a generic
  `change_requests` with a `kind`; rejected as premature for 2 request types.)

### 2. RLS + views
- RLS: seller **insert/select own** (`seller_id = my_profile_id()`), admin reads all, **only
  admin updates** (approve/reject). Applying the change (writing `sales.unit_price`) happens
  **server-side via an API route** after re-checking admin — seller never writes price.
- `v_my_price_requests` (SECURITY DEFINER) — seller sees her own with product name + date.
- `v_sale_price_requests` (security_invoker) — admin sees all, joined to seller/product/sale
  (qty, current price, requested price) for the inbox.

### 3. Workflow
1. Seller opens **Tahrirlash** on a sale. Qty stepper = direct (as today). Below it: **"Narx
   noto'g'rimi? Narxni tuzatishni so'rash"** → enters the correct unit price + reason.
2. Creates a `sale_price_requests` row (pending). `sales.unit_price` is **not** touched yet.
3. Admin sees it in **/admin/requests** (new "Narx so'rovlari" section): seller · product ·
   `qty × current → requested` · reason.
4. **Tasdiqlash** → server sets `sales.unit_price = requested_price` (guard: ≥ 0). **Rad etish**
   → no change, with a note.
5. Seller sees the outcome under **So'rovlarim**; the sale's amount/profit updates once approved.

### 4. Guardrails / invariants
- `requested_price ≥ 0`; only the seller's **own** sale; only **pending** can be resolved.
- One open price-request per sale (no duplicates/spam).
- Requests are records, never deleted → full audit of who changed a price and why.
- Approving recomputes money automatically (all money views read `sales.unit_price`). No manual
  recalculation — and **history stays correct** because each sale still stores its own price.

### 5. UI
- **Seller** — in the sale **Tahrirlash** block: keep the qty stepper (direct); add a price-
  request row. If a price request is pending for that sale → show "Narx so'rovi kutilmoqda"
  instead of the button. Add price requests to the **So'rovlarim** list too.
- **Admin** — extend `/admin/requests`: a **"Narx so'rovlari"** section (or a type badge in one
  unified list) with Tasdiqlash / Rad etish + optional note. The pending **nav badge** counts
  both allocation and price requests.

### 6. Notifications
- Owner Telegram DM on each new price request: *"💵 NARX SO'ROVI — GULSHAN: Abib — 50 000 →
  45 000 so'm"* (reuses `TELEGRAM_OWNER_CHAT_ID`).

### 7. API
- `/api/sale-price-request` (seller creates + Telegram ping).
- `/api/resolve-price-request` (admin approve/reject → update `sales.unit_price`).

### 8. Edge cases
- Sale deleted before approval → request cascades away (FK on delete cascade).
- Seller edits qty while a price request is pending → fine, independent fields.
- Price request on a return row (negative qty) → hide the option (returns are disabled anyway).

### 9. Phasing
- **Phase 1 (build):** table + RLS + views + seller request UI in Tahrirlash + admin inbox
  section + Telegram + So'rovlarim. Run one SQL doc (`docs/sale-price-request-setup.md`).

---

## Part B — Gulshan 50/50 commission

Camelia already stores commission **per seller** (`profiles.commission_rate`), and the admin
**Sotuvchilar** screen can edit it. So making Gulshan 50/50 = set her `commission_rate = 0.50`
(others stay `0.40`). Profit math needs **no code change**: `seller_profit = margin ×
commission_rate`, `my_profit = margin × (1 − rate)` → 50/50 at 0.50.

### The one decision — retroactive or not
The money views read the seller's **current** `commission_rate`, so changing it to 0.50
recalculates **all** of Gulshan's sales at 50% — past *and* future.
- **Option 1 — apply to all her sales (simple, recommended).** Matches the single-rate model;
  one field change (Sellers screen or one-line SQL). Her past profit/owed re-computes at 50%.
- **Option 2 — only from now on.** Requires snapshotting the commission rate **per sale** at
  sale time (new `sales.commission_rate` column + view changes). Bigger change; only worth it if
  her old sales must stay at 40%.

Recommendation: **Option 1** unless you specifically need her historical sales frozen at 40%.

---

## Build order
1. Confirm Gulshan retroactive vs from-now (Part B).
2. Set Gulshan to 50% (Sellers screen or SQL).
3. Build Part A Phase 1 (price requests).
