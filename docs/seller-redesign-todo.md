# Seller app redesign — to-do (from the "Organic Design" spec + mockups)

Source: `selleruxbuildspec.md` + the `.dc.html` mockups (10 screens). Scope = **`/seller/*` only**.
Golden rules kept: no `cost`/margin/owner-profit shown to sellers; money math stays in DB views;
seller reads via definer views; writes only to `sales` + existing APIs. Admin/storefront/DB untouched.

## Issues found (reconciling the design with what we already built)
- **I1 — Nav mismatch.** Design nav = 5 tabs: Bosh sahifa · Sotish · Sotuvlarim · Hisobim ·
  Sozlamalar. We have 4: Mahsulotlar · Tarix · So'rovlarim · Hisobim. The design has **no
  So'rovlarim tab**, but we built correction/new-product/price requests that need a status view.
  → **Decision:** adopt the 5-tab design; move **So'rovlarim** to a row inside **Sozlamalar**
  (kept, just not a bottom tab). Rename Mahsulotlar→Bosh sahifa, Tarix→Sotuvlarim.
- **I2 — Profit on the confirm step.** Mockup screen 6 shows "Siz ishladingiz: 42 000" *before*
  the sale is saved. We **can't** compute profit client-side (needs `cost`, which is hidden).
  → **Decision:** confirm screen shows the **sale amount** only; the real profit is shown on the
  **success** screen, read from `v_my_sales` after insert (as sell.tsx already does).
- **I3 — Card needs a cover photo everywhere.** Sell grid + history rows use product images →
  read `image_url`/`gallery` from `v_catalog` (already available).
- **I4 — Offline profit.** Offline sales can't show profit (view unreachable) → show "Saqlandi ⏳".
- **I5 — Contacts must be config-driven** (spec Task 2), not inline. New `src/consts/sellerConfig.ts`.

## Tasks (ordered; each ships + builds independently)
- [x] **T0 Foundation** — `sellerConfig.ts` (admin Telegram/phone/help-video) + new `S` strings.
- [x] **T1 Katta shrift (big text) toggle** — settings switch + root class, localStorage. *(safe/additive)*
- [x] **T2 Yordam (Help) sheet** — floating "?" on Home; Telegram/call/video, config-driven. *(additive)*
- [x] **T3 First-run welcome modal** — Home, localStorage `camelia_seller_welcome_v1`. *(additive)*
- [ ] **T4 Home card → "⋯" sheet** — card shows photo+name+tags+big Sotildi; move Tuzatish/
  Telegram/Video/Expiry into a per-product bottom sheet (reuse existing modals).
- [ ] **T5 Home chrome** — tappable "Bu oy siz ishladingiz → Batafsil" card (→ Hisobim);
  collapsible monthly chart; Help + Settings icons in header.
- [ ] **T6 SellerNav 5-tab** — Bosh sahifa · Sotish · Sotuvlarim · Hisobim · Sozlamalar.
- [ ] **T7 Sell 3-step flow** — (1) product grid w/ photos → (2) qty stepper + price buttons +
  live total → (3) confirm (amount only) → success + **Undo (10s)**. Preselect from Home card.
- [ ] **T8 Offline-safe sale queue** — localStorage queue on network failure; flush on load +
  `online`; dedupe by `client_ts`; "Saqlandi ⏳" state. *(spec Task 1)*
- [ ] **T9 Sotuvlarim (history) visual pass** — photo rows + month chips; keep our edit/price-
  request/delete + inline delete-confirm.
- [ ] **T10 Consistency pass** — Sozlamalar back-path + So'rovlarim row + Yordam row; no raw
  English errors; every destructive action confirmed. *(spec Task 4)*

## Notes
- Reuse existing components/logic: `SellerNav`, `expiry.ts`, `ImageGallery`, `S` strings,
  the "Tuzatish" modal, Telegram post sheet, price/qty requests, oversell guard, confetti.
- Optional (spec Task 5, later): `inputMode="numeric"` on price/qty; TTS read-aloud.
