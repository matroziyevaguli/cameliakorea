# Seller "Qaytarishlar" page — plan

## Problem
Transfers are scattered and unclear: sending is buried in a product's "⋯" sheet, and the
incoming confirm shows as a big card crammed onto the Home header (overlaps, looks broken).
A non-technical seller can't tell what's happening.

## Solution — one dedicated page: `/seller/transfers` ("Qaytarishlar")
Mirror the admin So'rovlar page: one place that shows everything and is self-explanatory.

### Layout (top → bottom)
1. **Rose header** "Qaytarishlar" + one-line explainer ("Sotilmagan mahsulotni boshqa
   sotuvchiga qaytaring — pul o'zgarmaydi").
2. **"+ Yangi qaytarish"** button → inline form:
   - **Mahsulot** (only products with `remaining > 0`)
   - **Kimga** (other active sellers, default = main seller)
   - **Nechta** (− N + stepper, capped at that product's remaining)
   - **Yuborish** → `POST /api/transfer-request`.
3. **"Sizga qaytarilmoqda"** (incoming, needs action) — cards: *X sizga · product · N ta* with
   big **Qabul qildim / Rad etish** (`POST /api/confirm-transfer`). Only shows if any pending.
4. **"Tarix"** — every transfer she's in (sent or received): direction, from→to, product, qty,
   status badge (Kutilmoqda / Tasdiqlandi / Rad etildi), date.

### Access + noticing it
- **SellerNav**: add a **"Qaytarish"** tab (icon ♻️) with a small **red badge** = count of
  incoming pending (like the admin So'rovlar badge). This is how she notices someone returned to her.
- Keep it discoverable from a product too: the "⋯" sheet's "Boshqa sotuvchiga qaytarish" becomes
  a **link to `/seller/transfers`** (no more in-sheet modal).

### Remove (cleanup)
- The big incoming card on the Home header → gone (moves to the page).
- The transfer modal on Home → gone (form lives on the page).
- Transfers rows in **So'rovlarim** → gone (they live on the new page now; So'rovlarim keeps
  correction/price/new-product only).

## Data (getServerSideProps, all via existing definer views — no new SQL)
- `v_my_transfers` — her transfers (has `is_outgoing`, names, product, qty, status).
- `v_my_inventory` (remaining) + `v_catalog` (names) — products she can send.
- `v_seller_names` — recipients.

## Guardrails (unchanged)
- Unsold units only; no money. Can't send more than `remaining`. Receiver confirms (not admin).
- Admin still just watches via So'rovlar → "Qaytarishlar (kuzatuv)".
