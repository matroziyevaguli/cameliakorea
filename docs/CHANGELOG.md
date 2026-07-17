# Changelog

All notable changes to the Camelia admin + seller app are tracked here.

---

## [2026-07-17] (latest)

### Added — Sale price-change requests (approval-gated) + Gulshan 50%
- Sellers edit a sale's **quantity** directly, but a **price** fix now goes through an admin
  **request → approve** (price changes money/profit). New `sale_price_requests` table + RLS +
  `v_my_price_requests` / `v_sale_price_requests`. Run `docs/sale-price-request-setup.md`.
- Seller: in Tarix → Tahrirlash, a "Narx noto'g'rimi?" request (price + reason); status shows
  in So'rovlarim. Admin: `/admin/requests` gets a "Narx so'rovlari" section; nav badge counts
  both request types; Telegram DM on each. Approve writes `sales.unit_price` (money recomputes).
- Gulshan commission → **0.50** (50/50), applies to all her sales. Plan: `docs/sale-price-request-plan.md`.

### Added — Installable PWA
- `manifest.webmanifest` (Camelia Korea Seller, start_url `/login?as=seller`, standalone) +
  rose→peach "C" icons (192/512/maskable, generated via `yarn gen-icons`) + minimal no-cache
  service worker registered in `_app`. Sellers can add it to the Android home screen; session
  persists (supabase cookies, 400-day maxAge).

### Added — Product batches (partiyalar) + FEFO
- New `product_batches` table: track each shipment separately with its own expiry + optional
  lot label, so you can tell old stock from new. Independent layer — `total_qty` unchanged.
- Admin **Partiyalar** tab (`/admin/batches`): add/delete batches per product; list is FEFO
  (first-expiring first) with near-expiry badges; "1-navbat" marks the batch to sell first;
  drift warning if batch quantities don't sum to `total_qty`
- Views `v_batches` (FEFO) + `v_batch_rollup` (per-product totals/earliest expiry)
- Run `docs/batches-setup.md`. Basis: `docs/research-batch-expiry.md`

### Added — Seller self-assignment (request a new product)
- Sellers can request a product they don't have yet (e.g. a just-arrived batch) via "Yangi
  mahsulot so'rash" → creates a `new_product` request in the admin inbox; approving allocates it
- New `v_available_products` (definer, price-only — never `cost`). Run `docs/self-assign-setup.md`
- Admin inbox labels each request as "Tuzatish" or "Yangi mahsulot"

### Added — Allocation correction requests (seller verify → admin approve)
- Sellers can flag that the quantity entered for them is wrong ("you gave me 4, I actually
  have 3"). Fixes the risk from the hand-typed initial distribution.
- Seller: "Son noto'g'rimi? Tuzatish so'rash" on each product card + a "So'rovlarim" section
  showing request status (kutilmoqda/tasdiqlandi/rad etildi) and admin note
- Admin: new **So'rovlar** tab (`/admin/requests`) inbox with pending-count badge on the nav;
  approve/reject with optional note
- Approve applies the corrected qty to `allocations`, guarded: can't drop below units already
  sold; DB `trg_alloc_within_stock` blocks going over product stock
- Telegram ping to the owner on each new request
- New: `allocation_requests` table + `v_my_requests` (definer) + `v_allocation_requests`
  (invoker) — run `docs/allocation-requests-setup.md`
- API: `/api/allocation-request` (seller creates), `/api/resolve-request` (admin approve/reject)
- Plan: `docs/allocation-requests-plan.md`

---

## [2026-07-16]

### Fixed — Seller balance showed 0 (critical)
- `/seller/balance` read `v_seller_balances`, which returns balance=0 for sellers due to the
  products-RLS cascade. Now reads `v_my_summary` (definer view, correct). See `docs/fix-products-rls.md`.

### Added — Payments: history + earnings clarity
- `/admin/payments`: payment history table (date/seller/note/amount) + delete + "To'liq" full-settle; client-side refresh
- `/seller/balance`: redesigned — big green "Sizning daromadingiz" (40% earnings) + hand-over blocks + read-only payment history
- New money labels in `src/consts/strings.ts`
- Plan: `docs/money-and-payments-plan.md`

### Fixed — Distribute (taqsimlash) mistake-proofing
- Boxes pre-fill with current allocation; show "hozir: N · sotildi: M"
- Floor guard: cannot set below units already sold (prevents negative `remaining`)
- Setting 0 removes a zero-sold allocation; freed units return to unallocated
- Live over-allocation guard; client-side refresh (no navigation crash)
- Plan: `docs/distribute-fix-plan.md`

---

## [2026-06-15]

### Added — Seller detail page
- New table-less view `v_admin_seller_products` (per seller+product: had/sold/left/revenue/seller_profit) — run `docs/seller-detail-setup.md` SQL
- Admin Sotuvchilar list: clicking a seller card opens `/admin/sellers/[id]`; pencil icon still edits commission/active inline (stops click propagation); chevron + hover affordance added
- New page `/admin/sellers/[id]`:
  - 5 summary cards (Umumiy savdo, Foydasi, Qarzi, Topshirgan, Qoldiq qarz) from `v_seller_balances` + product aggregation
  - Per-product table (Mahsulot / Bergan / Sotgan / Qolgan / Savdo / Foyda) with totals row, from `v_admin_seller_products`
  - Individual sales list (Sana / Mahsulot / Soni / Narxi) from `v_sales_enriched`, newest first
  - Built-in fallback (v_inventory + v_sales_enriched) so the page works before the new view's SQL is run

### Added — Product image gallery (multiple images)
- New table `product_images` (product_id, url, sort_order) — run `docs/gallery-setup.md` SQL
- `v_catalog` now returns a `gallery` JSON array of image URLs per product (cover stays in `products.image_url`)
- Admin Products form: "Natija rasmlari" area — upload MULTIPLE photos, thumbnails with delete, drag-to-reorder
- Client-side compression (`src/lib/image.ts`): every gallery image resized to ≤1080px wide, JPEG 0.8 before upload
- Gallery sync on Save: deletes removed rows, uploads new blobs to `gallery/` path, updates `sort_order` to match display order
- Seller cards: swipeable image gallery (cover first, then gallery photos) with scroll-snap, dot indicators, lazy-loaded images
- `.scrollbar-hide` utility added to globals.css for the gallery scroller

### Added — earlier today
- Image crop modal on Admin Products page (`react-image-crop` v11)
- Selecting an image now opens a crop modal instead of using the raw file directly
- Aspect ratio presets in the modal: Erkin (free), 1:1, 4:3, 16:9
- "Kesib olish ✂️" confirms the crop → canvas renders the cropped JPEG at native resolution → uploaded to Supabase Storage
- "Boshqa rasm / qayta kesish" button lets you re-pick or re-crop after a preview is set
- Blob URL cleanup on re-crop to prevent memory leaks
- `src/types/global.d.ts` — CSS module declaration so `react-image-crop/dist/ReactCrop.css` import is TypeScript-clean

---

## [2026-06-14]

### Changed
- `/api/find-youtube`: updated prompt to instruct the model to return `NONE` if no real video found (never invent URLs)
- `/api/find-youtube`: now returns `{ url: null }` when model says NONE or response has no valid YouTube URL — no more fallback to a search page
- Admin Products form: shows "YouTube'da video topilmadi — qo'lda kiriting" if AI finds nothing, instead of silently doing nothing

---

### Added
- `products.link` column (YouTube video URL) — run `docs/link-column-setup.md` SQL
- `v_catalog` now includes `link`
- `/api/find-youtube` — server-side AI route that searches for a YouTube review link using Claude + web_search
- Admin Products form: "Video link (YouTube)" text field + "🔗 YouTube link topish" AI finder button
- Seller product cards: "▶️ Videoni ko'rish" button when a link exists
- Telegram posts now include an inline keyboard button "▶️ Videoni ko'rish" (via `reply_markup`) when the product has a video link

---

## [2026-06-13]

### Added
- `products.description` column + AI description generator (`/api/generate-description`)
- Admin Products form: "Tavsif" textarea + "✨ AI bilan yozish" button (Claude Haiku + web_search)
- `v_catalog` now includes `description`
- Seller product cards show description text
- Telegram caption includes description block

### Added (earlier)
- Full skincare business management app under `/admin` and `/seller`
- Supabase Auth (email/password), role-based routing, RLS guards
- Seller screens: product cards, record-a-sale, sales history, balance
- Admin screens: dashboard, products CRUD, distribute, sellers, payments, stats
- K-beauty UI redesign: Quicksand + Inter fonts, rose/peach/lavender palette
- Product image upload to Supabase Storage (`product-images` bucket)
- Telegram "Post to Camelia Store" feature (`/api/announce`)
- New seller views: `v_catalog`, `v_my_inventory`, `v_my_summary`, `v_my_sales`, `v_my_monthly`
- `formatUZS` and `formatDate` helpers (locale-independent, no hydration errors)
