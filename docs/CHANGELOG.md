# Changelog

All notable changes to the Camelia admin + seller app are tracked here.

---

## [2026-07-16] (latest)

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
