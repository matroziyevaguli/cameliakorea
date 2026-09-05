# i18n plan — make the whole app multilingual (default Uzbek)

Goal: the site defaults to **Uzbek**, and a visitor can switch language (for the portfolio
showcase). Nothing hardcoded left untranslated.

## What already exists
- **Next.js built-in i18n** in `next.config.js`: `locales: ['en','ko','uz']`, `defaultLocale: 'en'`,
  `localeDetection: false`. Used today only by the **portfolio** (`careers/owner/*`) via
  `src/lib/i18n.ts` (a `copy` dict keyed by locale, read through `router.locale`) and
  `components/LanguageSwitcher.tsx` (switches with `router.push(..., { locale })`).
- **Seller strings are already centralized** in `src/consts/strings.ts` (`S.*`, ~97 keys) — easy to
  translate. Everything else (public + admin pages) is **hardcoded Uzbek in JSX**.

## Decisions (confirm)
- **Languages:** `uz` (default) · `en` · `ru`. (`ko` stays available for the portfolio.)
- **Default:** switch `next.config` `defaultLocale` → **`uz`** so `/` is Uzbek; `/en/…`, `/ru/…`
  are prefixed. Keep detection off. Update the noindex rewrite regex to include `ru`.
- **Scope order:** Phase A **public/customer** (what portfolio viewers see) → Phase B **seller** →
  Phase C **admin**. (Confirm whether admin/seller need full translation or Uzbek-only is fine.)

## Architecture
- Reuse Next's `router.locale`. Add a **shop dictionary** `src/i18n/` with one file per namespace,
  each key → `{ uz, en, ru }` (fallback to `uz` if a key is missing).
- A **`useT()`** hook: `const t = useT()` → `t('key')`, plus `useLocale()`. Reads `router.locale`;
  works in client render and SSR (locale from `ctx.locale`).
- Migrate `consts/strings.ts` (`S`) into the dictionary; provide a thin `useS()` or replace `S.x`
  call-sites with `t('x')`.
- A shop **language switcher** (UZ/EN/RU pill) placed in the public header, seller header, admin nav.
- **Data stays as-is** (product names, questions, answers are user content — not translated). Only
  **UI chrome** is translated. Currency `so'm` label can be localized ("so'm"/"sum"/"сум").

## Per-page / per-area checklist (nothing left)

### Foundation
- [ ] `next.config.js`: `defaultLocale: 'uz'`, add `ru` to locales + noindex regex.
- [ ] `src/i18n/` dictionaries (uz/en/ru) + `useT()`/`useLocale()` + fallback.
- [ ] Shop `LanguageSwitcher` (UZ/EN/RU) component.
- [ ] `_app.tsx`: nothing required for built-in i18n, but persist last choice (cookie) for return visits.

### Shared strings (libs/consts) — used across many pages
- [ ] `consts/strings.ts` (seller `S.*`, ~97) → dictionary.
- [ ] `lib/availability.ts` — state labels (Bor / Kam qoldi / Tugadi / Yo'lda …) + `sellerLabel`.
- [ ] `lib/expiry.ts` — expiry status labels.
- [ ] `consts/community.ts` — topic labels. `consts/skincare.ts` — skin/concern labels.
- [ ] `consts/geo.ts` — region labels. `lib/format.ts` — currency suffix.

### Phase A — Public / customer
- [ ] `pages/index.tsx` (landing: hero, how-to, catalog, CTA, footer) + `LoginMenu`, `HeaderCart`, `CartFab`.
- [ ] `pages/product/[id].tsx` (buy area, qty, badges).
- [ ] `pages/tavsiya.tsx` (survey steps, results) + skincare labels.
- [ ] `pages/savat.tsx` (cart, checkout form, remove-confirm) + geo regions.
- [ ] `pages/buyurtma/[id].tsx` (status labels, payment, receipt) + `CardPreview`.
- [ ] `pages/buyurtmalarim.tsx` (my orders, tabs, statuses).
- [ ] `pages/community.tsx` (intro, ask modal, chips, success) + `TelegramLogin`.
- [ ] `pages/login.tsx`.

### Phase B — Seller app
- [ ] `SellerNav`, `pages/seller/index.tsx`, `sell.tsx`, `sales.tsx`, `balance.tsx`,
  `requests.tsx`, `transfers.tsx`, `settings.tsx` + `HelpSheet`, `ConfirmBar`, `Loader`.

### Phase C — Admin app
- [ ] `AdminNav`, `pages/admin/index.tsx`, `products.tsx`, `batches.tsx`, `distribute.tsx`,
  `sellers.tsx`, `sellers/[id].tsx`, `orders.tsx`, `community.tsx`, `payments.tsx`,
  `giveaways.tsx`, `requests.tsx`, `stats.tsx` + `NotificationBell`.

### Cross-cutting
- [ ] Meta titles/descriptions per page (localized `<Head>`), `lang` attr, date/number formatting.
- [ ] API-returned Uzbek error strings — either translate keys client-side or leave (v1: leave;
  they're already friendly Uzbek). Note for later.

## QA / done criteria
- Every listed page renders fully in **uz / en / ru** with no leftover hardcoded text and no
  missing-key fallbacks showing raw keys.
- `/` defaults to Uzbek; switcher persists choice; `yarn build` + `tsc` clean.

## Effort note
The heavy part isn't the dictionary — it's **replacing hundreds of call-sites** across ~30 files
with `t('…')`. Phasing (A→B→C) lets the portfolio-visible surface land first.
