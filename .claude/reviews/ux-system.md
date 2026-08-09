# Camelia — Cross-cutting UX & Design-System Review

System-level review of the layer that cuts across all pages: `globals.css`, `tailwind.config.js`, `_app`/`_document`, `login`, storefront (`index`, `product/[id]`), `src/components/*`, `src/lib/{i18n,format}`, `src/consts/strings`, `src/UI/*`. Read-only; no source files modified.

Highest-leverage three (details below): **(1)** fix `.big-text` + sub-16px inputs with ~4 lines of CSS (P0-1, P0-3); **(2)** actually load the fonts — `font-display` is used 168× and currently renders as system-sans (P0-4); **(3)** introduce `.btn-primary` / `.card` component classes to collapse ~54 button and ~91 card strings (P1-5, P1-6).

---

## P0 — breaks a real user on a device, or misconfigures/leaks the public surface

### `.big-text` silently fails to enlarge the smallest text
`globals.css:222` · **CONFIRMED**

`.big-text` sets only the root font-size (`html.big-text{font-size:18.5px}`), so it scales **rem**-based classes (`text-xs`…`text-3xl`) but has **zero effect on `text-[Npx]` arbitrary values**, which are absolute pixels. There are **43** pixel-locked labels across pages/components (`grep -c 'text-\[[0-9]+px\]'`): bottom-nav labels (`SellerNav.tsx:44` `text-[11px]`, badge `:42` `text-[9px]`), notification timestamps (`NotificationBell.tsx:163` `text-[11px]`), the seller money-strip labels (`seller/index.tsx:362` `text-[10px]`), transfers table (`transfers.tsx:281/287/307/329/333`), balance (`balance.tsx:67/140/144`). The accessibility toggle a low-vision seller enables leaves exactly the hardest-to-read text unchanged.

**Fix:** in `globals.css` under `html.big-text`, redefine those steps once, e.g. `.big-text .text-\[10px\]{font-size:.72rem} .big-text .text-\[11px\]{font-size:.78rem} .big-text .text-\[9px\]{font-size:.66rem}`. One CSS block, fixes all 43 call-sites, no TSX edits.

### Bottom nav ignores the iOS safe-area
`SellerNav.tsx:33` · **CONFIRMED**

The nav is `fixed bottom-0 … py-3` with **no** `env(safe-area-inset-bottom)` padding, and **no page sets `viewport-fit=cover`** (`grep safe-area` → NONE; only `index.tsx:84` has any viewport meta). The app is an installable PWA (`manifest.webmanifest` `display:standalone`), so on any iPhone with a home indicator the nav's tap row sits under the indicator and the active tab's bottom edge is hard to reach. Pages pad `pb-28` for the nav's height but the nav itself has no inset.

**Fix:** add `viewport-fit=cover` to a shared viewport meta in `_document.tsx` Head (inherited by every page), and give the nav `paddingBottom: env(safe-area-inset-bottom)`.

### iOS input-zoom on sub-16px fields
`seller/index.tsx:414`, `seller/sales.tsx:296`, `seller/index.tsx:676/678/723/726`, `seller/sales.tsx:378/380` · **CONFIRMED** (severity PLAUSIBLE — depends on iOS share of sellers)

Mobile Safari zooms the viewport when a focused input has font-size < 16px. Multiple seller inputs are `text-sm` (14px): home/sales search, receive-qty/reason, price-edit fields. Each focus jerks the layout and forces a pinch-back. (Login/settings/sell already use `text-base`/`text-xl` — correct.)

**Fix:** one global rule in `globals.css`: `@media (max-width:640px){ input,select,textarea{ font-size:16px } }`. No page edits.

### Font family never loads — the theme's typography is a no-op
`tailwind.config.js` fontFamily; `globals.css:27` · **CONFIRMED**

`font-display`/`font-sans` map to `var(--font-quicksand)`/`var(--font-inter)`, and `font-display` is used **168×**. But those CSS variables are **never defined** (`grep 'next/font|--font-quicksand|Quicksand|fonts.googleapis'` → only a Recharts inline ref). `globals.css:27` hardcodes `font-family: Inter,…` on body as fallback, so **every "display" heading and every price silently renders in the system sans stack**. The "Quicksand for numbers and headings" intent (ux-walkthrough §0.3) is invisible.

**Fix:** add `next/font` in `_app.tsx` (Quicksand → `--font-quicksand`, Inter → `--font-inter`) applied to a wrapper, or define the two vars in `globals.css :root` via `@font-face`. ~10 lines; instantly restyles 168 sites.

---

## P1 — real friction or maintenance hazard

### Primary-button styling copy-pasted ~54× with drift
storefront/seller/admin, e.g. `login.tsx:110`, `product/[id].tsx:109`, `sell.tsx:259` · **CONFIRMED**

`from-rose to-peach` appears **59×**; **54** are the primary-button gradient, in **~47 distinct class strings** differing only in noise: `py-4` vs `py-3.5` vs `py-3`, `disabled:opacity-50/-60/-40/absent`, `shadow-rose` before vs after `active:scale-95`. Same button, 47 spellings — every tweak is a 47-file sweep.

**Fix:** one `.btn-primary` (and `.btn-secondary`/`.btn-danger`) in a `@layer components` block in `globals.css`, or a `<Button>` component. Migrate opportunistically; the class fixes appearance with no TSX churn.

### Card shell repeated ~91× in 41 variants
e.g. `seller/index.tsx:428`, `index.tsx:145` · **CONFIRMED**

`shadow-card` appears **91×**; `bg-surface rounded-2xl shadow-card` is the canonical card but exists in **41 distinct** strings. Empty states are hand-repeated: `bg-surface rounded-2xl shadow-card p-10 text-center text-muted` appears **6×** (`seller/index.tsx:419`, `transfers.tsx:275`, …) each re-typing icon + message, with padding drift (`p-8`/`p-10`/`p-16`).

**Fix:** a `.card` component class in `globals.css @layer components`, plus a small `<EmptyState icon message />` (only ~9 sites) that also normalizes padding.

### 111 raw default-Tailwind colors bypass the theme
21 files incl. `SellerNav.tsx`, `ConfirmBar.tsx`, `availability.ts:59-65` · **CONFIRMED**

The theme defines `success/warning/danger/muted`, but raw palette is used **111×** across **21 files**: `border-gray-100` (28), `bg-red-50` (13), `bg-green-50/100` (18), `bg-orange-50/100` (16), `bg-gray-200` (4), `text-yellow-700/800` (4). `border-gray-100` (28×) is the de-facto divider that should be one token. `availability.ts` `STATE_STYLE` mixes raw + token in the same string (`bg-green-100 text-success`).

**Fix:** add semantic tint tokens (`successBg`, `dangerBg`, `warningBg`, `line`) to `tailwind.config.js` and sweep the 4–5 most common raw classes.

### `src/UI/*` is dead portfolio code shipped in the bundle
`src/UI/*.tsx` (7 files), `src/consts.ts` (362 lines) · **CONFIRMED**

All `src/UI/*` and `src/consts.ts` are imported **only** by `src/pages/careers/owner/*` — the developer's personal résumé site co-hosted in the Camelia app (`grep '@/UI'` outside `careers` → none; `grep "from '@/consts'"` → only UI/ + careers). `tailwind.config.js` still scans `./src/app/**`, which doesn't exist. Inflates bundle and review surface.

**Fix:** not a UX bug — flag for the leader. Move `careers/` + `UI/` + `consts.ts` to a separate project, or confirm the co-hosting is intentional.

### i18n is real for the portfolio, absent for the actual product
`src/lib/i18n.ts`, `src/consts/strings.ts`, `next.config.js` i18n · **CONFIRMED**

`i18n.ts` (120 lines, en/ko/uz) and `LanguageSwitcher` are used **only** by `careers/owner/*` (3 files). Storefront + both apps are hardcoded Uzbek: **~284** inline Uzbek literals across pages/components, vs the `S` catalog imported by only **10** files (75 keys, **20 unused**). `admin/products.tsx` (826 lines) has **23** inline strings and imports `S` **zero** times; storefront `index.tsx` has **22** inline. `next.config.js` advertises `locales:['en','ko','uz']`, so `/ko/` and `/uz/` storefront URLs exist but render identical Uzbek — a duplicate-content trap on the one indexed page.

Unused `S` keys (safe to delete): `namePlaceholder, logout, addSale, pickProduct, quantity, note, notePlaceholder, confirm, delete, moneySettled, openingDebt, salesDebt, totalOwed, paid, remaining_bal, changePassword, onlyInStock, noStockToSell, som, pcs`.

**Fix:** the apps are Uzbek-only by design — fine. Make `strings.ts` the single source and have admin pages adopt `S` (keeps terminology canonical — see next). Consider dropping the unused ko/uz storefront locales from `next.config.js` to kill the duplicate URLs. Don't build app i18n.

### Same money concept, different words on different screens
`balance.tsx:144` vs `sales.tsx:286/327/408`; `sellers/[id].tsx:71` vs `strings.ts:48/74` · **CONFIRMED** (violates redesign.md G3/§1.2)

§1.2 mandates one root word per concept. Reality: "profit" is **`Daromad`** in seller balance/home (`balance.tsx:144`, `strings.ts:51`) but **`Foyda`** in seller sales (`sales.tsx:286/327/408`), the seller chart (`index.tsx:385`) and admin (`admin/index.tsx:86`, `sellers/[id].tsx:152`) — **5** `Foyda` sites. "Debt owed" is **`Yig'ilishi kerak`** (`strings.ts:48`) vs **`Qoldiq qarz`** (`sellers/[id].tsx:71`) vs **`Sizning qarzingiz`** (`strings.ts:74`). A seller and admin reading the same number see two different words.

**Fix:** adopt `Daromad` (spec's choice), replace the 5 `Foyda` sites; unify the debt label.

### Two spinners defined, the nicer one unused; loading/success/error reinvented per page
`Loader.tsx:5` (`Spinner`), error banners across ~10 files · **CONFIRMED**

`Loader.tsx` exports `Spinner` (3-dot brand) but **`<Spinner` is never rendered** anywhere (grep → 0); only `MiniSpinner` and ad-hoc `Loader2 animate-spin` (`admin/products.tsx:490/504/533`) are used. Error banners exist in **~10 distinct** class strings (`text-danger text-xs`, `text-danger text-sm text-center bg-red-50 rounded-xl py-3`, `bg-red-50 text-danger text-sm text-center py-3 rounded-xl`, …). Success is re-typed (`payments.tsx:207`, `giveaways.tsx:113`). No shared toast/error surface.

**Fix:** `<FormError>` / `<FormSuccess>` pair collapses ~15 sites; delete or actually use `Spinner`. A shared toast is a larger lift — flag, don't block.

### Storefront ships raw `<img>` with no dimensions → potential CLS, no optimization
`index.tsx:195`, `product/[id].tsx:60/72`; `next.config.js` `images.unoptimized:true` · **CONFIRMED**

`next.config.js` sets `images:{unoptimized:true}`; the public storefront uses raw `<img>` (**15** raw `<img>` app-wide; `next/image` only in the portfolio). Grid images have `loading="lazy"` and an `aspect-square` parent (mitigates CLS — good), but the `<img>` tags carry no `width`/`height`. Full-size Supabase URLs are served unoptimized (upload compresses to 1080px via `image.ts`, so bounded) with no responsive `srcset`. This is the one public, indexed page.

**Fix:** add `width`/`height` attrs to silence CLS; keep the `aspect-square` wrappers. `next/image` would need a custom loader given `unoptimized:true` — lower priority.

### Storefront OG/meta is thin; no `og:image`, no Twitter card, no JSON-LD
`index.tsx:79-88`, `product/[id].tsx:39-44` · **CONFIRMED**

Public `index.tsx` Head has `og:title`/`og:description` (`:82-83`) but **no `og:image`** (portfolio has one at `portfolio.tsx:26`; the store doesn't), no `twitter:card`, no `og:url`/`og:type`. `product/[id].tsx` has **no OG tags at all** — a shared product link previews blank. No `Product` JSON-LD despite being a shoppable catalog. The existing `og.png` is a **1.2 MB** portfolio image, wrong for the store.

**Fix:** add `og:image` (a real Camelia image), `og:url`, `twitter:card=summary_large_image` to both public pages; product `og:image` = first product photo. Cheap; direct impact on Telegram/social shares.

---

## P2 — polish

### Gradient page-header has 5 spellings; overlap constant drifts
`seller/index.tsx:316` and 4 others · **CONFIRMED**

The "gradient header + card overlap" pattern (ux-walkthrough §0.3) exists as `pt-10 pb-20`, `pt-10 pb-14`, `pt-8 pb-12`, `pt-10 pb-8` (×2) with overlaps `-mt-12` vs `-mt-6`. The first card sits at a different height per screen.

**Fix:** a `<GradientHeader>` wrapper, or accept as cosmetic.

### Icon-only-button `aria-label` coverage is partial (mostly good)
124 `<button>` / 51 `aria-label` · **CONFIRMED**

The important icon-only buttons are labeled (close/qty/back/bell/menu all have labels); remaining unlabeled buttons carry text, so redesign G6 is largely satisfied. `admin/products.tsx` crop/gallery controls and a few chevrons should be audited by the admin-flows agent. Low risk.
