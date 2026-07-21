# Camelia — full UX walkthrough (seller + admin)

Every page, every button, what each one does, and where the flow goes next.
Written as the shared reference for redesigning the UI/UX.

Scope: everything **after login**. The public storefront (`/`, `/product/[id]`) is
covered only where it touches the two apps. Uzbek labels are quoted exactly as they
appear on screen so this doc can be read next to the running app.

**Legend**
`→` navigates · `⟳` writes to the DB then re-renders · `⊞` opens a modal/sheet ·
`⚠` UX friction, collected again in §7.

---

## 0. Foundations shared by both apps

### 0.1 Roles and entry
| Role | Login | Lands on | Guard |
|---|---|---|---|
| Admin (Guli) | `matroziyevaguli@gmail.com` | `/admin` | `requireRole(ctx,'admin')` on every admin page |
| Seller | `<ism>@sellers.local`, generated from the name | `/seller` | `requireRole(ctx,'seller')` on every seller page |

Every page is server-rendered (`getServerSideProps`) and role-guarded before any
markup is produced. A seller who types `/admin/products` is bounced, and vice versa.

### 0.2 Two different navigation models
- **Seller** — a fixed **bottom tab bar** (`SellerNav`), 5 tabs, thumb-reachable,
  phone-first. Always visible; pages add `pb-28` to clear it.
- **Admin** — a sticky **top bar** (`AdminNav`), 9 links + "Chiqish", collapsing to a
  hamburger under `md`. Desktop-first.

Both carry one live red badge:
| Badge | Where | Counts | Refreshes on |
|---|---|---|---|
| Seller | "Qaytarish" tab | returns awaiting **my** confirmation | route change + `camelia-transfers-changed` event |
| Admin | "So'rovlar" tab | pending allocation + price requests | route change + `camelia-requests-changed` event |

### 0.3 Visual system
Rose→peach gradient = the primary action, everywhere, in both apps. Green/mint = money
earned or a success state. Orange/warning = attention. Red/danger = destructive or a
debt. Cream page background, white `surface` cards, `rounded-2xl`, soft `shadow-card`,
`active:scale-95` press feedback on every primary button. Display font for numbers and
headings, Inter for body.

Seller pages open with a **gradient header** whose bottom is overlapped by the first
card (`-mt-6`/`-mt-12`) — a consistent, recognisable page-opening pattern.

### 0.4 Cross-cutting behaviours
- **Offline sales queue** — a sale tapped with no signal is stored in `localStorage`
  (`pendingSales`) and flushed on reconnect. Only the sell flow has this.
- **Big text** — a per-device toggle in seller Settings adds `.big-text` to `<html>`.
- **Refresh after write** — most mutations call `router.replace(router.asPath)`, i.e. a
  full server re-render. A few pages (admin products, distribute, payments, requests)
  update state client-side instead and feel noticeably faster. ⚠
- **Language** — Uzbek only in both apps.

---

## 1. `/login` — the shared door

The only page both roles see. Rose→peach full-bleed background, one white card.

| Element | Behaviour |
|---|---|
| **Name dropdown** ("Ismingizni tanlang") | Admin + every active seller, loaded from `v_login_sellers`; falls back to `['GULSHAN','ADOLAT','SAIDA']` if the view is missing. Picking a name *is* picking the email — nobody types an address. |
| **Password field** | Plain password. |
| **"Kirish"** | ⟳ `signInWithPassword` → reads `profiles.role` → `/admin` or `/seller`. Shows a spinner + "Kirilmoqda…". |

`?as=admin` / `?as=seller` (from the landing page's "Kirish" menu) filters the dropdown
to just that role. An already-logged-in visitor is redirected away server-side.

⚠ No password reset, no "remember me", and one generic error string for every failure —
a seller who mistypes cannot tell a wrong password from a wrong name, and her only
recovery is to phone the admin.

---

# 2. THE SELLER APP

Designed for a non-technical person on a phone, possibly with poor signal. Guiding
principles visible in the code: **one primary action per screen**, no jargon, no
destructive native dialogs (mostly), and money always framed as *hers* vs *to hand over*.

## 2.1 `/seller` — Bosh sahifa (home)

The most important screen in the product. Top to bottom:

**a) Header** (rose→peach)
| Element | Action |
|---|---|
| "Salom, <ism>" + "Bu oy foydangiz: <sum>" | Display only. The first thing she sees is *her* money this month. |
| **?** icon | ⊞ HelpSheet |
| **⚙ icon** | → `/seller/settings` |

**b) Status banners** (conditional) — green "N ta sotuv yuborildi" after an offline
flush; orange "N ta sotuv kutilmoqda" while queued.

**c) Four money cards** (2×2)
| Card | Tap |
|---|---|
| "Sotilgan" — revenue + "N ta sotilgan" | → `/seller/sales` |
| "Daromadingiz" (green gradient) — her lifetime profit | → `/seller/balance` |
| "Topshirilishi kerak" — red if > 0 | → `/seller/balance` |
| "Topshirilgan" | → `/seller/balance` |

**d) "Oylik grafik"** — collapsed by default; the chevron expands a Recharts monthly
profit bar chart. Progressive disclosure, deliberately.

**e) Products section**
| Element | Action |
|---|---|
| "Mening mahsulotlarim" heading | — |
| **"+ Yangi mahsulot so'rash"** (only when unassigned products exist) | ⊞ new-product request sheet |
| **Search box** | Client-side filter by name |

**f) Product card** — repeated per allocated product
| Element | Action |
|---|---|
| **Swipeable gallery** | Cover photo first, then result photos; scroll-snap with dots. No photo → a coloured initial. |
| **Remaining badge** (top-right of photo) | Green "N ta qoldi" / orange ≤2 / red "Tugadi" |
| **Product name** | — |
| **"⋯"** | ⊞ per-product actions sheet (below) |
| **Price** | Strikethrough retail + rose discount, or plain retail |
| **Sold progress** | "3 tadan 1 ta sotildi" + a bar; ≤10 items draw one pill per unit, unsold slots dashed. |
| **Status chips** | Expiry warning (expired/critical/soon) and "so'rov kutilmoqda" |
| **"Sotildi"** (big rose pill) | → `/seller/sell?product=<id>` — **the primary action of the whole app** |
| — replaced by a grey inert **"Tugadi"** when `remaining === 0` | |

**g) "⋯" sheet**
| Row | Action |
|---|---|
| "Son noto'g'ri — Tuzatish" | ⊞ the Tuzatish modal |
| "Telegram kanalga yuborish" (needs a photo) | ⊞ post composer |
| "Videoni ko'rish" (needs a link) | → YouTube, new tab |
| "Boshqa sotuvchiga qaytarish" (needs stock) | → `/seller/transfers` |
| **Expiry date + "Saqlash"** | ⟳ `/api/set-expiry` |

**h) "Tuzatish" modal** — two clearly separated sections, because they have different
trust levels:
1. **"Sizga berilgan soni"** — she types what she *actually* received → ⟳
   `/api/allocation-request`, **admin must approve**. Locked out while one is pending.
2. **"Sotilgan sonini tuzatish"** — her own sale rows, each with **"Tahrirlash"**
   (±stepper → "Saqlash") and a **trash** icon (native `confirm()` ⚠). These apply
   **immediately, no approval**.

**i) First-run welcome** — a one-time reassuring modal, dismissed into `localStorage`.

⚠ Findings: the card now carries four separate "how much is left" signals (badge, progress
label, progress bar, and the Sotildi/Tugadi button state). The trust model is inverted —
she may **delete a sale outright** but must **ask permission to fix a price**. And the
Tuzatish modal duplicates the sale-editing UI that already exists on `/seller/sales`,
with a different look.

## 2.2 `/seller/sell` — the sale flow

Reached only from a card's "Sotildi" (the nav tab was deliberately removed). Three steps
with a back chevron and progress dots.

| Step | Screen | Buttons |
|---|---|---|
| **1 · "Nima sotildi?"** | 2-column photo grid of in-stock products (skipped when arriving with `?product=`) | tap a product → step 2 |
| **2 · "Nechta va qancha?"** | Big −/+ stepper (capped at `remaining`), price presets showing real amounts: "To'liq narx", "Chegirma narx", "Boshqa narx" (+ numeric input), live total | **"Davom etish"** → step 3 |
| **3 · "To'g'rimi?"** | One sentence: "N ta <mahsulot> — <summa>" over a big photo | **"Ha, sotildi"** ⟳ insert · **"Yo'q, orqaga"** → step 2 |

**Success screen** — 🎉 confetti, "Sotildi!", her profit in large rose type (read from
`v_my_sales`, never computed client-side), an **"Bekor qilish (N)"** undo link counting
down 10s, then auto-return home. **"Yana sotish"** restarts at step 1; "Bosh sahifaga"
exits.

**Offline path** — no signal → the sale is queued and a calm orange clock screen appears
instead. It also fires a background `/api/low-stock-check` (Telegram alert to the owner)
on every successful sale.

⚠ The 10-second undo then auto-navigates away; after that the only fix is finding the row
on `/seller/sales`. Step 1's grid duplicates the home product list.

## 2.3 `/seller/sales` — Sotuvlarim

| Block | Behaviour |
|---|---|
| **Two summary cards** | "Sotilgan (N ta)" revenue + green "Foyda" — recalculated live from the current filter |
| **Search + month dropdown** | Client-side filters |
| **"Mahsulotlar bo'yicha" table** | Per-product qty + profit rollup |
| **"Har bir sotuv (N)"** | One card per sale: photo, name, "N × narx", her profit, date, amount. Returns render on a red background with a "Qaytarilgan" chip. |

Per-sale buttons:
| Button | Action |
|---|---|
| **"Tahrirlash"** | Opens an inline editor: ±stepper, live total, **"Saqlash"** ⟳ (DB oversell guard surfaces as an error), "Bekor" |
| — inside the editor: **"💵 Narx noto'g'rimi?"** | Price + reason → ⟳ `/api/sale-price-request`, **needs admin approval**; shows "Narx so'rovi yuborildi" while pending |
| **Trash icon** | Inline confirm card ("Bekor qilish" / "Ha, o'chirish") — a good non-native pattern ⟳ |

⚠ Sale photos are matched **by product name** (`images[sale.product_name]`), so renaming a
product silently drops its thumbnails from history.

## 2.4 `/seller/balance` — Hisobim

Pure read-only money explainer. No destructive actions.

| Block | Behaviour |
|---|---|
| **"Sizning daromadingiz"** (green hero) | Her lifetime kept profit + "…% sizniki" hint |
| **"Topshirilgan"** card | **Tappable** — toggles the breakdown |
| **"Topshirish kerak"** card | Display |
| **Breakdown** (on tap) | Plain-language money flow: collected → hers kept → Camelia's share → of which paid / left, with a closing explainer paragraph |
| **"Qolgan qarz"** hero | Rose when owing, green + "Hammasi to'langan" when settled |
| **"Oylik hisobot"** | Per-month cards: units, "Savdo", "Daromadingiz" — screenshot-friendly for sending to the admin |
| **"To'lovlar tarixi"** | Every payment the admin recorded, newest first |

This page is the clearest piece of UX in the product: it answers "how much is mine and
how much do I owe" in one screen, in words rather than accounting terms.

## 2.5 `/seller/transfers` — Qaytarish

Seller-to-seller returns of unsold stock. **No money moves** — stated in the header.

| Block | Buttons |
|---|---|
| **"+ Yangi qaytarish"** | Opens a form: product dropdown (with counts), recipient dropdown (defaults to the main seller), ±stepper capped at what she holds → **"Yuborish"** ⟳ `/api/transfer-request`. Confirms with "So'rov yuborildi — qabul qiluvchi tasdiqlaydi". |
| **"Sizga qaytarilmoqda"** (mint cards) | **"Qabul qildim"** / **"Rad etish"** ⟳ `/api/confirm-transfer`; fires `camelia-transfers-changed` to clear the nav badge |
| **"Tarix"** | Direction arrow (Siz → X / X → Siz), qty, date, status chip |

Note the ownership model: **the receiver confirms, not the admin.** The admin only
watches (§3.5).

## 2.6 `/seller/requests` — So'rovlarim

A read-only status list of her three request types: "Tuzatish", "Yangi" (new product)
and "Narx", each with a status chip and the admin's note when resolved.

⚠ **Reachable only via Settings → "Mening so'rovlarim".** It has no nav tab and no badge,
so the answer to a request she is waiting on is three taps deep, while the card on the
home page only shows a small "so'rov kutilmoqda" chip.

## 2.7 `/seller/settings` — Sozlamalar

| Row | Action |
|---|---|
| **"Katta shrift"** toggle | Adds `.big-text` to `<html>`, saved per device |
| **"Mening so'rovlarim"** | → `/seller/requests` |
| **"Yordam"** | ⊞ HelpSheet |
| **Password form** | Two fields, min 6, must match → ⟳ `updateUser`, green "Parol o'zgartirildi!" |
| **"Chiqish"** | ⟳ sign out → `/login` |

**HelpSheet** (from here and from the home header) — three config-driven contacts:
Telegram to the admin, a `tel:` link, and an optional how-to video.

---

# 3. THE ADMIN APP

Desktop-first, information-dense, table-driven. Where the seller app hides complexity,
this one exposes it.

## 3.1 `/admin` — Dashboard

Read-only. No buttons at all beyond the nav.

| Block | Content |
|---|---|
| **"Biznes holati" hero** | "Sotildi <X> / <Y>" with a white progress bar = revenue ÷ total inventory worth, and the % underneath |
| **4 metrics** | "Qo'yilgan pul" (Σ cost×qty) · "Umumiy qiymati" (Σ price×qty) · "Kutilayotgan foyda" · "Sovg'alar" (units + cost) |
| **4 KPI cards** | "Umumiy savdo" · "Mening foydam" · "Yig'ilishi kerak" · "Sotilgan (dona)" — computed over **all** sales |
| **"Ko'p sotilgan mahsulotlar"** | Top-8 bar chart |
| **"So'nggi sotuvlar"** | 15 newest: seller · product · ×qty · revenue · date |

⚠ `invested` and `worth` multiply **today's** cost/price by `total_qty` = *everything ever
received*, so both drift upward permanently as stock is restocked and sold — see
`docs/product-availability-problem.md` §2c. The dashboard and `/admin/stats` also overlap
heavily without either being the obvious place to look.

## 3.2 `/admin/products` — Mahsulotlar

| Element | Action |
|---|---|
| **"+ Yangi mahsulot"** | ⊞ create modal |
| **Expiry strip** | Orange when any product is expired/critical; **"Muddat hisobotini yuborish"** ⟳ `/api/expiry-check` → Telegram to the owner, result shown inline |
| **Table** | Thumb · Nomi (+ expiry chip) · Retail · Chegirma · Xarid · Soni |
| **"📢 Post"** (per row, needs a photo) | Expands an inline composer: photo, prefilled caption, **"Telegram kanalga jo'natish"** ⟳ `/api/announce`, then a green "Posted" |
| **✏️ pencil** | ⊞ edit modal |

**Create/edit modal** — the densest screen in the app:
| Field | Notes |
|---|---|
| Nomi · Mahsulot narx · Chegirma narx · Xarid narxi · Jami soni | Validated: no negatives, discount ≤ retail |
| **Rasm** dropzone | Click → ⊞ **crop modal** (Erkin / 1:1 / 4:3 / 16:9 → "Kesib olish ✂️"), then "Boshqa rasm / qayta kesish" and "Olib tashlash" |
| **Tavsif** + **"AI bilan yozish"** | ⟳ `/api/generate-description` |
| **Video link** + **"YouTube link topish"** | ⟳ `/api/find-youtube`; explains when nothing is found |
| **Yaroqlilik muddati** | Date |
| **"Natija rasmlari"** + **"Rasm qo'shish"** | Multi-upload, client-compressed to ≤1080px, **drag to reorder**, hover-trash per image, numbered |
| **"Saqlash"** | ⟳ product + storage upload + gallery diff (deletes, inserts, `sort_order`), then refreshes the list client-side |

Side effect: **lowering or adding a discount on an existing product** auto-posts a
discount announcement to the buyers' channel and shows a toast. ⚠ This is a public,
outward-facing action triggered as a *side effect of pressing Saqlash*, with no
confirmation and no opt-out.

⚠ "Jami soni" is the single hand-edited stock number — the restock problem in
`docs/product-availability-problem.md`. There is no delete-product action anywhere.

## 3.3 `/admin/batches` — Partiyalar

One card per product: "Ombor: N ta · partiyalarda: M ta", plus an orange **drift warning**
when those disagree.

| Button | Action |
|---|---|
| **"+ Partiya"** | Inline form: Soni · Yaroqlilik muddati · lot label · izoh → **"Qo'shish"** ⟳ |
| **Batch rows** | FEFO-sorted (soonest expiry first); the first of several is tagged **"1-navbat"**; expiry chip colour-coded; trash (native `confirm()` ⚠) |

This is the shipment record the availability problem needs — it just isn't wired to
anything customer- or seller-facing yet.

## 3.4 `/admin/distribute` — Taqsimlash

Assign stock to sellers. The subtlest screen in the app.

| Element | Behaviour |
|---|---|
| **Product dropdown** | Each option shows "— N ta bo'sh"; selecting shows the photo and **pre-fills every seller's box with their current allocation** |
| **3 tiles** | Jami · Taqsimlangan · Qoldi (red when negative) |
| **Per-seller rows** | "hozir: N · sotildi: M" + a number input |
| **Guards** | Over-allocation and "below already sold" both block **"Saqlash"** with a specific message |
| **"Saqlash"** | ⟳ Diffs into insert/update/delete ops, applies **reductions before increases**, then refreshes cells client-side. Green "Saqlandi!" |
| **"Taqsimlanmagan mahsulotlar"** | Table of everything with unallocated units left, or "Hammasi taqsimlangan ✅" |

⚠ The number is the seller's **new total**, not an amount to add — explained only in one
line of small grey text. Getting this wrong silently reassigns stock.

## 3.5 `/admin/requests` — So'rovlar (the inbox)

Three stacked sections:

**1. "Taqsimot so'rovlari"** — one card per pending request: seller, product, type chip
("Tuzatish" / "Yangi mahsulot"), a `now → requested` row with "sotilgan: N", her reason,
an optional admin note field, then **"Tasdiqlash"** / **"Rad etish"** ⟳
`/api/resolve-request`. Blocked when the request is below what she already sold.
If approval would exceed recorded stock, a **native `confirm()`** offers to raise the
product's total and retries. ⚠ blocking dialog

**2. "Narx so'rovlari"** — same shape, `current → requested` price, ⟳
`/api/resolve-price-request`.

**3. "Qaytarishlar (kuzatuv)"** — **read-only**; the receiving seller confirms these.

**"Ko'rib chiqilgan (N)"** collapses the resolved history of both types. Resolutions
update local state immediately and fire `camelia-requests-changed` to clear the nav badge.

## 3.6 `/admin/giveaways` — Sovg'alar

Marketing giveaways: stock leaves, no money and no debt.

Form: Mahsulot · "Kimning omboridan" · Soni · Kanal (Telegram/Instagram/Boshqa) ·
"G'olib" · Izoh → **"Sovg'ani yozib qo'yish"** ⟳ writes `stock_adjustments` with
`reason:'giveaway'`. History below with a channel chip and a "N ta sovg'a · M dona" total.

## 3.7 `/admin/sellers` — Sotuvchilar

| Element | Action |
|---|---|
| **"+ Yangi sotuvchi"** | Form: Ism · Parol · Komissiya % · Boshlang'ich qarz → **"Sotuvchi yaratish"** ⟳ `/api/create-seller`; returns the generated login and explains the `ism → ism@sellers.local` rule |
| **Seller row** | Click anywhere → `/admin/sellers/<id>` |
| **✏️ pencil** | Inline edit: Ism · Komissiya % · Boshlang'ich qarz · **"Faol"** checkbox → "Saqlash" ⟳ |

Chips show commission, opening debt, and Faol/Nofaol.

## 3.8 `/admin/sellers/[id]` — one seller

| Block | Content |
|---|---|
| **5 gradient cards** | Umumiy savdo · Foydasi · Qarzi (jami) · Topshirgan · Qoldiq qarz (red/green) |
| **"Mahsulotlar bo'yicha"** | Bergan / Sotgan / Qolgan / Savdo / Foyda, with a totals row |
| **"So'nggi sotuvlar"** | Last 100 |
| **"Ombor tuzatish"** | Form: product (with "qoldi: N") · Soni · Sabab (Buzilgan / Yo'qolgan / Sovg'a / Boshqa) · Izoh → **"Qo'shish"** ⟳ `stock_adjustments`; the log below shows each as **−N** |

## 3.9 `/admin/payments` — To'lovlar va foyda

| Block | Content |
|---|---|
| **"Qanday ishlaydi"** explainer | States plainly that "Topshirish kerak" is mostly returning stock money, not profit |
| **3 KPI cards** | Mening jami foydam · Yig'ilishi kerak · Yig'ilgan |
| **Per-seller table** | Sotgan · Ularning foydasi · **Mening foydam** · Topshirish kerak · Topshirilgan · Qolgan (negative renders as `+sum` = you owe her), with the seller's % as a chip |
| **"To'liq ✓"** | Native `confirm()` ⚠ → inserts a payment for the exact outstanding balance ⟳ |
| **"To'lov qabul qilish"** form | Sotuvchi (with "qoldi: …") · Miqdor · Izoh → **"To'lovni saqlash"** ⟳ |
| **"To'lov tarixi"** | Every payment, with a **trash** per row (native `confirm()` ⚠) |

## 3.10 `/admin/stats` — Statistika

Read-only. A grouped Sotildi/Qoldi bar chart, the same data as a table
(Jami/Sotildi/Qoldi/Tushum), and one coloured tile per seller (Sotuvdan qarz / To'lagan /
Qoldi). ⚠ Substantially overlaps `/admin` and `/admin/payments`.

---

## 4. The round-trip flows

**A · A sale.** Seller taps "Sotildi" on a card → 3 steps → insert into `sales` →
confetti + profit + 10s undo → `remaining` drops everywhere → `/api/low-stock-check` may
Telegram the owner → the admin sees it in "So'nggi sotuvlar" and in every money view.
Offline: queued locally, flushed on reconnect, banner on the home page.

**B · "I received a different amount".** Card "⋯" → Tuzatish → section 1 → 
`allocation_requests` (pending) → card shows "so'rov kutilmoqda", admin badge +1 →
admin approves (optionally bumping stock) → allocation updated → the chip clears and
`/seller/requests` shows "Tasdiqlandi".

**C · "I sold it at the wrong price".** `/seller/sales` → Tahrirlash → "💵 Narx
noto'g'rimi?" → `sale_price_requests` → admin approves → the sale's `unit_price` and every
derived profit number change. (Quantity, by contrast, she changes herself.)

**D · A return between sellers.** Sender: `/seller/transfers` → new → recipient +
qty → pending. Recipient: red nav badge → "Qabul qildim" → stock moves. The admin only
observes it under "Qaytarishlar (kuzatuv)".

**E · Money hand-over.** Sales accrue `owed = cost + my_profit` per seller → she sees
"Topshirish kerak" on `/seller/balance` → hands over cash → admin records it on
`/admin/payments` (or "To'liq ✓") → her "Qolgan qarz" drops and the payment appears in
her history.

**F · A restock.** Admin edits "Jami soni" upward on `/admin/products` (optionally adding
a batch on `/admin/batches`) → distributes on `/admin/distribute` → sellers' cards show
new counts. ⚠ Nothing about this cycle is visible to customers or recorded as an event —
this is the subject of `docs/product-availability-problem.md`.

---

## 5. Screen inventory

| Route | Role | Primary job | Primary action |
|---|---|---|---|
| `/login` | both | Get in | "Kirish" |
| `/seller` | seller | See stock + sell | "Sotildi" |
| `/seller/sell` | seller | Record a sale | "Ha, sotildi" |
| `/seller/sales` | seller | Review + fix sales | "Tahrirlash" |
| `/seller/balance` | seller | Understand her money | (read-only) |
| `/seller/transfers` | seller | Move stock between sellers | "Qabul qildim" |
| `/seller/requests` | seller | Track her requests | (read-only) |
| `/seller/settings` | seller | Password, text size, help | "Parolni saqlash" |
| `/admin` | admin | Business at a glance | (read-only) |
| `/admin/products` | admin | Catalog + prices + media | "Saqlash" |
| `/admin/batches` | admin | Shipments + expiry | "+ Partiya" |
| `/admin/distribute` | admin | Allocate stock | "Saqlash" |
| `/admin/requests` | admin | Approve seller requests | "Tasdiqlash" |
| `/admin/giveaways` | admin | Log marketing giveaways | "Sovg'ani yozib qo'yish" |
| `/admin/sellers` | admin | Manage the team | "Sotuvchi yaratish" |
| `/admin/sellers/[id]` | admin | One seller in depth | "Qo'shish" (adjustment) |
| `/admin/payments` | admin | Collect money | "To'lovni saqlash" |
| `/admin/stats` | admin | Reporting | (read-only) |

---

## 6. What is genuinely good (keep it)

1. **One primary action per seller screen**, always the same rose pill in the same place.
2. **The sell flow** — 3 short steps, real amounts on the price buttons, a confirmation
   sentence in plain Uzbek, confetti, her profit as the reward, and an undo.
3. **Offline resilience** in exactly the one place it matters.
4. **`/seller/balance`** explains a consignment split in words, not accounting terms.
5. **Trust boundaries encoded in the UI** — approval-required actions are visually
   separated from immediate ones inside the Tuzatish modal.
6. **Distribute's guards** — can't over-allocate, can't drop below sold, reductions
   applied first.
7. **The payments explainer** stops "Topshirish kerak" being misread as profit.
8. **Big-text toggle** — real accessibility for the actual users.

---

## 7. Friction list (candidates for the redesign)

**Consistency**
1. **Three different confirmation patterns**: a nice inline confirm card (`/seller/sales`),
   native `confirm()` (Tuzatish modal, batches, payments ×2, requests stock-bump), and
   none at all. Native dialogs also **block the page** on Android.
2. **Two editors for the same sale rows** — the Tuzatish modal and `/seller/sales`, with
   different layouts.
3. **Money vocabulary differs by role** for the same quantity: "Topshirilishi kerak"
   (seller) vs "Yig'ilishi kerak" (admin); "Daromadingiz" vs "Ularning foydasi".
4. Some pages refresh via a full SSR round-trip, others update in place — the app feels
   inconsistently fast.

**Information architecture**
5. `/seller/requests` is buried in Settings with no badge, though it holds the answers
   she's waiting for.
6. `/admin` and `/admin/stats` (and part of `/admin/payments`) present overlapping
   numbers with no clear division of labour.
7. Admin nav is a flat list of 9 items with no grouping (catalog / stock / money / people).
8. `/seller/sell` step 1 re-lists the products she just came from.

**Trust model**
9. A seller may **delete a sale** with no trace, but must **request approval to change a
   price**. Deletion is the more destructive of the two.
10. Adding or lowering a discount **auto-posts to the public Telegram channel** as a side
    effect of "Saqlash", with no confirmation.

**Clarity**
11. Distribute's replace-vs-add semantics rest on one line of small grey text.
12. The seller product card now carries four overlapping "how much is left" signals.
13. `remaining = 0` means five different real-world things → `docs/product-availability-problem.md`.
14. Admin dashboard `invested`/`worth` value *everything ever received* at *today's* cost.

**Robustness / detail**
15. Sale thumbnails are matched by product **name**, so renaming loses them.
16. Login has no password reset and one generic error for every failure.
17. No product deletion or archival anywhere in the admin.
18. Several icon-only buttons (trash, pencil) have no `aria-label`.
19. The admin app has no offline handling at all, though it is used on phones too.

---

## 8. Suggested reading order for a redesign

1. This document, §2.1 and §2.2 first — they carry ~90% of daily seller usage.
2. `docs/product-availability-problem.md` — the open data-model question that will change
   what product cards must show in **both** apps and on the storefront.
3. §7 above, treating *Consistency* and *Trust model* as the first pass: they are cheap,
   affect every screen, and do not depend on the availability decision.
