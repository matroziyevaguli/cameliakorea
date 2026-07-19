# Camelia Seller UX — Build Spec for Claude Code

> **Hand this file to Claude Code.** It's a self-contained brief to design/build the seller
> app for **non-technical, village, first-time-smartphone users** (test user: "Guli's
> sister"). It states the design system, the principles, what's already built, and the exact
> remaining tasks with acceptance criteria.
>
> Companion docs: [`seller-experience-plan.md`](./seller-experience-plan.md) (the why),
> [`camelia-master-plan.md`](./camelia-master-plan.md) (money model + golden rules).

---

## 0. Goal & scope

Make the **seller-facing app** (`/seller/*`) effortless for someone who can use Telegram and
take photos but finds abstract apps confusing. **Scope = `/seller` pages only.** Do **not**
touch the admin app, the public storefront, the portfolio, the money math, or the database
views/RLS.

**North star:** every screen feels like Telegram — big pictures, big buttons, few words, one
job at a time, nothing you can break, and you always *see* what just happened.

---

## 1. Design system — use these exactly (do not invent new colors)

From `tailwind.config.js` (already in the project — reference the token names, don't hardcode hex):

| Token | Hex | Use |
|---|---|---|
| `cream` | `#FFF7F3` | page background |
| `surface` | `#FFFFFF` | cards |
| `rose` | `#F4628E` | primary accent / main buttons |
| `roseDark` | `#E14B79` | pressed/hover accent |
| `peach` | `#FFB088` | gradient partner (`from-rose to-peach`) |
| `lavender` `#B9A7F0`, `mint` `#6FD8C0`, `sky` `#7CC4F2` | | secondary accents, placeholder gradients |
| `ink` | `#2D2433` | primary text |
| `muted` | `#8A7F8C` | secondary text |
| `success` `#2FBF8F`, `warning` `#FFB020`, `danger` `#F25C5C` | | semantic states (stock/expiry/errors) — **not** the accent |

**Type:** `font-display` = Quicksand (rounded, friendly) for headings/numbers/buttons;
`font-sans` = Inter for body. **Fonts are already wired** — just use the classes.

**Signature patterns (already in the codebase — reuse, don't reinvent):**
- Primary button: `bg-gradient-to-br from-rose to-peach text-white font-display font-bold rounded-full shadow-rose active:scale-95`
- Card: `bg-surface rounded-2xl shadow-card` (or `rounded-3xl` for hero cards)
- Header: `bg-gradient-to-br from-rose to-peach` with two translucent white blob circles
- Bottom sheet/modal: `fixed inset-0 z-50`, dim `bg-black/40`, panel `rounded-t-3xl`
- Shared components: `SellerNav` (bottom tabs), `lib/expiry.ts` (`expiryInfo`, `EXPIRY_LABEL`),
  `ImageGallery` + `Thumb` (photo-or-gradient-initial placeholder), `S` strings in `consts/strings.ts`

**Language:** all UI in **Uzbek**. Add new strings to `src/consts/strings.ts` (object `S`) —
never hardcode English, never show a raw database error.

---

## 2. The eight principles (apply to every screen)

1. **One screen, one job** — linear flows, no branching mazes.
2. **Look like Telegram** — familiar card/gesture/nav patterns.
3. **Big & thumb-friendly** — ≥56px targets, actions near the bottom, one-handed.
4. **Impossible to break** — every money/stock action reversible + confirmed; offer Undo.
5. **Show, don't tell** — product photo at every step; success = big check + the number.
6. **Earnings first** — lead with "Siz ishladingiz X", not debt. Avoid the word *qarz*.
7. **Forgive mistakes** — prevent bad input; friendly Uzbek errors with a way forward.
8. **Cheap phone, weak signal** — light, fast, offline-tolerant.

---

## 3. Already built (do not redo — extend/respect)

| File | What's done |
|---|---|
| `src/pages/seller/index.tsx` | Home redesigned: one big **Sotildi** per card; secondary actions (Telegram/video/expiry/Tuzatish) moved into a **"⋯" bottom sheet**; earnings-first header; **tappable money card** → Hisobim; **collapsed monthly chart**; **first-run welcome modal** (localStorage `camelia_seller_welcome_v1`); auto expiry chip; safer delete confirm |
| `src/pages/seller/sell.tsx` | Record-a-sale rebuilt as a **3-step flow**: (1) visual product grid, (2) big qty stepper + price buttons with real amounts + live total, (3) **review & confirm** card; **Undo** on the success screen; friendly errors; cover photos from `v_catalog` |
| `src/pages/seller/settings.tsx`, `sales.tsx` | Raw English errors replaced with friendly Uzbek messages |
| `src/lib/offlineSales.ts` + `sell.tsx` + `index.tsx` | **Offline-safe saving (Task 1 ✅)**: no-signal sales queue in localStorage and show "Sotuv saqlandi ⏳"; home flushes the queue on load and on the `online` event with a "N ta sotuv yuborildi ✓" toast; queued sales keep their original timestamp |

**Golden rules already respected — keep respecting:** sellers never see `cost`/margin/owner
profit; money math stays in DB views (`v_my_*`); seller reads go through the definer views,
never base tables; writes only to `sales` (+ `allocation-request`/`set-expiry`/`announce` APIs).

---

## 4. Remaining tasks (build these, in order)

### Task 1 — Offline-safe sale recording  ✅ DONE
Village signal is unreliable. A tapped sale must never silently vanish.
Implemented in `src/lib/offlineSales.ts` + `sell.tsx` + `index.tsx` (see the table above).

**Original spec (for reference):**
- On `submit()` in `sell.tsx`, if the insert fails due to **network** (offline/timeout),
  queue the sale locally (`localStorage`, e.g. key `camelia_pending_sales`) with
  `{seller_id, product_id, qty, unit_price, note, client_ts}`.
- Show a calm state, not an error: **"⏳ Internet yo'q — sotuv saqlanib turibdi, internet kelganda yuboriladi."** Still show the earned-profit celebration is NOT possible offline (profit comes from the view) — instead show "Saqlandi ⏳" and return home.
- On app load (home) and on `window` `online` event, **flush the queue**: re-insert each
  pending sale, remove on success. Show a small "N ta sotuv yuborildi" confirmation.
- Never double-insert: remove from queue only after a confirmed insert; dedupe by `client_ts`.

**Acceptance:** with the network off, recording a sale shows the "saqlanib turibdi" state and
persists across a reload; turning the network on flushes it and it appears in history exactly
once.

### Task 2 — Persistent Help / "Yordam" button
A familiar escape hatch reduces fear.

**Spec:** a small floating **"?"** on `/seller` (and optionally sell/sales/balance) opening a
sheet with: **Admin bilan bog'lanish** (Telegram link — put the handle/number in
`consts/strings.ts` or a config, **not** hardcoded inline), and a one-line "how to record a
sale" reminder. Optional: a link to a short how-to video URL (config-driven).

**Acceptance:** Help is reachable in one tap from Home; contact target is config-driven.

### Task 3 — "Katta shrift" (bigger text) toggle
**Spec:** a setting (in `/seller/settings`) that bumps base font size (e.g. a `text-lg` root
class or a CSS variable) for low-vision comfort; persisted in `localStorage`.
**Acceptance:** toggling enlarges body/labels app-wide and survives reload.

### Task 4 — Consistency pass
**Spec:** ensure every seller page has the same chrome; `/seller/settings` gets a clear back
path; remove any duplicate settings entry points; confirm all destructive actions have a
confirm + (where possible) undo.
**Acceptance:** no seller page shows a raw English string; no destructive action lacks a confirm.

### Task 5 (optional) — Voice & audio
**Spec:** ensure price/qty/note inputs use `inputMode="numeric"` and are voice-keyboard
friendly; optionally a 🔊 to read the sale-confirm summary and balance aloud (browser TTS).
**Acceptance:** custom price/note accept the phone's Uzbek voice keyboard cleanly.

---

## 5. Guardrails (must not break)
- Don't show `cost`, `margin`, or owner profit on any seller screen.
- Don't compute money in the app — read `v_my_*` views.
- Don't route seller reads through base tables (RLS blocks them) — use the definer views.
- Don't touch admin, storefront, portfolio, or the DB schema/views/RLS.
- All new copy in Uzbek, in `consts/strings.ts`.

---

## 6. How to verify
- `npx tsc --noEmit` is clean for touched files; no unused imports.
- Run the app (`yarn dev`), log in as a seller, and drive each flow on a **phone-width**
  viewport.
- **The real test:** watch an actual non-technical seller record a sale without help. Every
  hesitation is a design bug — fix it, re-test.
