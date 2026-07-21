# Camelia redesign — the build spec ("what needs to be done")

The actionable companion to `camelia-ux-redesign.md`. That doc is the *why*;
this is the *what* and *in what order*. Every screen is wireframed, every rule is
stated, every task has an acceptance check. Built on the spine from
`availability-plan.md`.

**How to read this**
- §1 Glossary — the shared vocabulary. Fix this first; everything references it.
- §2 Interaction grammar — global rules every screen obeys.
- §3 Data changes — the availability-plan work this UI depends on.
- §4 Seller app — screen by screen.
- §5 Admin app — screen by screen.
- §6 Build checklist — phased, with acceptance criteria and a definition of done.

Notation in wireframes: `[ Button ]` primary · `[ Button ]ᵍ` grey/disabled ·
`( field )` input · `‹ ›` state/label · `⟳` writes to DB · `→` navigates ·
`⊞` opens sheet/modal.

---

## 1. Shared vocabulary (the glossary) — do this first

One concept → one Uzbek word → used identically in both apps and the storefront.
This table **is** the spec for copy. Replace every synonym in code with the
canonical term.

### 1.1 Pipeline A — Stock

| Canonical (Uzbek) | English | Meaning | Shown to | Replaces / today |
|---|---|---|---|---|
| **Buyurtma** | ordered | Shipment ordered, not shipped | admin only | (didn't exist) |
| **Yo'lda** | in transit | Ordered, en route, not in UZ | customer, seller, admin | (didn't exist) |
| **Keldi** | arrived | Landed in Uzbekistan (72h "just arrived" flag) | all three | `received_date` set |
| **Bor** | in stock | Arrived, units available | all three | `remaining > threshold` |
| **Kam qoldi** | low | Arrived, few left | all three | orange badge ≤2 |
| **Tugadi — yo'lda** | sold out, restock coming | 0 left, a shipment is on the way | customer, seller | `remaining = 0` (ambiguous) |
| **Tugadi** | sold out | 0 left, nothing incoming | all three | `remaining = 0` (ambiguous) |
| **Sotuvchilarda** | with sellers | Distributed/allocated | admin | "allocated" |
| **Sotildi** | sold | Sold to a customer | all three | `sales` |
| **Endi keltirilmaydi** | discontinued | Not coming back; hidden from catalog | admin (customer: hidden) | (didn't exist) |

### 1.2 Pipeline B — Money

| Canonical (Uzbek) | English | Meaning | Replaces today's split naming |
|---|---|---|---|
| **Sotildi** | sold | A sale happened | — |
| **Yig'ilishi kerak** | to be collected | Owed to Camelia (cost + Camelia's profit share) | seller "Topshirilishi kerak" **and** admin "Yig'ilishi kerak" → **one word** |
| **Topshirildi** | handed over | Cash the seller has handed over | seller "Topshirilgan" / admin "Yig'ilgan" |
| **Hisob-kitob** | settled | Balance cleared | "Qolgan qarz = 0" |
| **Daromad** | earnings/profit | Money kept by whoever earned it | seller "Daromadingiz" / admin "Mening foydam" — keep role suffix, same root word |

**Rule:** never introduce a new word for a concept already in this table. If a
screen needs a concept not here, add a row here first.

---

## 2. Interaction grammar (global rules)

These are cross-cutting. They cost little, touch every screen, and don't depend
on any data change — **ship them first (Phase 1).**

**G1 · One confirmation pattern.** The inline confirm card from `/seller/sales`
(a red "Ha, o'chirish" / grey "Bekor" pair rendered in place) is the *only*
confirmation UI. Remove **every** `window.confirm()` (Tuzatish modal, batches
trash, payments "To'liq ✓", payments-history trash, requests stock-bump). Native
dialogs block the page on Android and break the visual language.

**G2 · One refresh model.** Every mutation updates local state optimistically,
then reconciles. No page mixes SSR-reload writes with client-state writes. Target
feel: instant on every screen.

**G3 · One vocabulary.** §1 is law. Grep the codebase for the "replaces" strings
and swap them.

**G4 · Destructive = reversible + traced.** No hard deletes of sales. "Delete"
becomes **Bekor qilingan** (cancelled/returned) with a reason and an audit row.
The admin can see every seller edit; the seller never needs approval to correct
her *own* data (§4.3).

**G5 · Outward actions are never side effects.** Anything that posts to a public
channel (Telegram) requires an explicit tap + preview + confirm. Saving a product
never posts on its own (fixes the silent-discount-post).

**G6 · Every icon-only button has an `aria-label`.** Trash, pencil, chevrons,
bell, gear.

**G7 · Identity by id, not name.** Sale ↔ product photos key on `product_id`,
never `product_name`. Renaming never loses history.

**G8 · One recovery path on login.** "Parolni unutdingizmi?" (deep-links a
Telegram message to admin is fine) + distinct error messages for wrong-name vs
wrong-password.

---

## 3. Data changes this UI depends on

Straight from `availability-plan.md` — listed here as the dependency checklist so
the UI work and DB work stay in lockstep.

- **D1** `product_batches.status` (`ordered|in_transit|arrived|cancelled`),
  `ordered_date`, `eta`, `unit_cost`. Existing rows default `arrived`.
- **D2** Arrival invariant trigger: `arrived ⇔ received_date NOT NULL`.
- **D3** `products.discontinued_at`.
- **D4** `v_product_availability` producing the `state` enum (§1.1).
- **D5** `v_catalog` (anon, RLS-safe, **no cost**) exposing `state`.
- **D6** Flip stock source to derived (`received_qty`), retire drift; correct
  `invested`/`worth` to current stock at per-batch cost.

UI phases 2, 4, 5 (below) consume D4, D1+D2, D6 respectively.

---

## 4. Seller app — screen by screen

### 4.0 Frame

```
┌─────────────────────────────────────────┐
│  Salom, {ism}      Daromad: {oy}    🔔² ⚙ │  ← header (gradient), bell badged
├─────────────────────────────────────────┤
│                 { page }                  │
├─────────────────────────────────────────┤
│  🏠 Sotish  🧾 Sotuvlar  💰 Hisob  ↩️ Qaytarish²│  ← 4 tabs, big targets
└─────────────────────────────────────────┘
```

Settings and Requests are **not** tabs. Settings → ⚙. Requests → 🔔 (§4.6).

### 4.1 Sotish (home) — the product list *is* the sell picker

```
┌ header ─────────────────────────────────┐
│ Salom, Gulshan      Daromad: 1 200 000  🔔² ⚙ │
├──────────────────────────────────────────┤
│  ‹green banner: "2 ta sotuv yuborildi"›   │ ← conditional (offline flush)
│  ┌ money strip (tap → Hisob) ───────────┐ │
│  │ Sotilgan  Daromad  Yig'ilishi  Topshi.│ │ ← 4 mini-tiles, NOT 2×2 cards
│  └───────────────────────────────────────┘ │
│  ( 🔍 qidirish )                            │
│  ┌ product card ─────────────────────────┐ │
│  │ [photo gallery ····]        ‹Bor·8 ta›│ │ ← ONE signal (top-right)
│  │ Atir №5            240 000            │ │
│  │ [        Sotildi        ]   (tap card→⊞)│ │ ← button=sell, card body=detail
│  └───────────────────────────────────────┘ │
│  ┌ product card ─────────────────────────┐ │
│  │ [photo]              ‹Tugadi — yo'lda 🚚›│ │
│  │ Loson              180 000            │ │
│  │ [      Kutilyapti      ]ᵍ             │ │
│  └───────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

**Changes vs today**
- Four stock signals → **one** `state` badge (§1.1). Per-unit pills move into the
  detail sheet (tap card body).
- The 2×2 money cards become a compact **strip**; the star metric (Daromad) is in
  the header, so the strip is a secondary summary, not four big competing cards.
- Tapping the **card body** opens the stock-detail sheet (§4.4). Tapping
  **Sotildi** starts the sale (§4.2). Two clearly different targets.
- "Oylik grafik" stays collapsed-by-default (good progressive disclosure).
- First-run welcome modal stays.

**Removed:** the home "Tuzatish" modal (its two functions relocate — sale edits →
Sotuvlar §4.3; "wrong quantity received" → stock sheet §4.4).

### 4.2 Sell — 2 steps, launched from a card

Home is step 0 (the picker). **No standalone product grid.**

```
 Sotildi (on card)
      │
      ▼
┌ Step 1 · Nechta va qancha? ───────────┐
│   [ − ]   3   [ + ]     (max = qoldi)  │
│   ‹ To'liq 240 000 › ‹ Chegirma 200 000›│
│   ‹ Boshqa ( ___ ) ›                    │
│   Jami: 720 000                         │
│               [ Davom etish ]           │
└─────────────────────────────────────────┘
      │
      ▼
┌ Step 2 · To'g'rimi? ──────────────────┐
│   [ big photo ]                        │
│   "3 ta Atir №5 — 720 000"             │
│   [ Ha, sotildi ]   [ Orqaga ]         │ ⟳ insert sale
└─────────────────────────────────────────┘
      │
      ▼
┌ Success ──────────────────────────────┐
│   🎉 Sotildi!                          │
│   Daromadingiz: +180 000  (from v_my_sales)│
│   [ Bekor qilish (10) ]  ← full 10s, NO auto-nav│
│   [ Yana sotish ]   [ Bosh sahifa ]    │
└─────────────────────────────────────────┘
```

**Changes vs today**
- One product list total. Step-1 duplicate grid deleted.
- Success screen **does not auto-navigate**; it waits for a choice so the undo is
  reachable for its full life.
- Keep: offline queue + orange "kutilmoqda" screen; background low-stock check.

### 4.3 Sotuvlar — the *only* place to edit a sale

```
┌ summary (live, respects filter) ────────┐
│  Sotilgan (N ta) {revenue}   Daromad {sum}│
├──────────────────────────────────────────┤
│  ( 🔍 )   ( oy ▾ )                         │
│  ┌ "Mahsulotlar bo'yicha" rollup table ─┐ │
│  └───────────────────────────────────────┘ │
│  Har bir sotuv (N)                         │
│  ┌ sale row ─────────────────────────────┐ │
│  │ [img] Atir №5  3×240 000   +180 000   │ │
│  │ 12-iyul                    [ Tahrirlash ]│
│  └───────────────────────────────────────┘ │
│    ▸ inline editor:                        │
│      [ − ] 3 [ + ]  Jami 720 000           │
│      [ Saqlash ]  [ Bekor ]                │ ⟳ (G2 optimistic)
│      [ Bekor qilingan deb belgilash ]      │ ← replaces hard delete (G4)
│         → reason chips: Qaytardi / Xato    │
└──────────────────────────────────────────┘
```

**Trust rule (symmetric, §4 of redesign doc):** the seller edits **qty and price
of her own sale** immediately. Each edit writes an audit row visible to the
admin. No approval gate for correcting her own data. (The old asymmetry — free
delete, approval to fix price — is gone.)

Returns render on the red background with a **Bekor qilingan** chip. Photos keyed
by `product_id` (G7).

### 4.4 Stock detail sheet (from tapping a card body)

Shows the product's position in **Pipeline A**, plus the occasional actions that
used to clutter the "⋯" menu.

```
⊞ Atir №5
   ‹Keldi 12-iyul›  ·  Sizda 8 ta  ·  3 ta sotildi
   ────────────────────────────────
   ▪ Boshqacha son oldim        → allocation-request ⟳ (admin approves)
   ▪ Yaroqlilik muddati ( date ) [ Saqlash ] ⟳
   ▪ Boshqa sotuvchiga qaytarish → Qaytarish
   ▪ Telegram kanalga yuborish   ⊞ composer (needs photo)
   ▪ Videoni ko'rish             → YouTube
```

"Boshqacha son oldim" is the *only* survivor of the old Tuzatish modal's
approval-gated half — correctly reframed as a **stock** action, not a sale edit.
Its answer arrives in 🔔.

### 4.5 Hisob (money) — keep it, relabel to Pipeline B

Structure is already the clearest screen in the app; only two edits:
- Station names become exactly **Sotildi → Yig'ilishi kerak → Topshirildi →
  Hisob-kitob** (§1.2).
- When the admin records a payment, a 🔔 item ("To'lov qabul qilindi: {sum}")
  fires so her debt-drop is noticed without hunting.

Keep: green earnings hero, tappable breakdown, monthly report cards
(screenshot-friendly), payment history.

### 4.6 🔔 Notification centre (new) — everything waiting on her

```
⊞ Bildirishnomalar
   • So'rovingiz tasdiqlandi: "8 ta oldim"        ‹Tuzatish›
   • Sizga 2 ta qaytarilmoqda — tasdiqlang        → Qaytarish
   • Narx so'rovi rad etildi: izoh "…"            ‹Narx›
   • To'lov qabul qilindi: 500 000                → Hisob
   [ Hammasini o'qilgan deb belgilash ]
```

Sources: allocation-request results, price-request results, incoming transfers,
payments recorded. Badge = unread count. **This replaces the buried
`/seller/requests` page** — requests are no longer 3 taps deep in Settings.
(A full history list still lives behind ⚙ → "Mening so'rovlarim" for the curious.)

### 4.7 ⚙ Settings

Behind the gear, not a tab. Rows: Katta shrift toggle · Mening so'rovlarim
(history) · Yordam (HelpSheet) · Parol o'zgartirish · Chiqish. Unchanged except
it's no longer competing for a tab slot.

---

## 5. Admin app — screen by screen

### 5.0 Frame — 5 areas

```
┌───────────────────────────────────────────────────────────┐
│  Camelia   Boshqaruv  Mahsulotlar  Sotuvchilar  Pul  So'rovlar³  Chiqish │
└───────────────────────────────────────────────────────────┘
```

Nine flat links → five grouped areas. Batches + Distribute live **inside**
Mahsulotlar. Stats folds into Boshqaruv. Giveaways folds into Pul.

### 5.1 Boshqaruv (overview) — dashboard + stats merged, money corrected

```
┌ Biznes holati ───────────────────────────┐
│  Sotildi {X} / {Y}  ▓▓▓▓▓░░░  {%}          │ ← revenue ÷ CURRENT worth
├────────────────────────────────────────────┤
│ Qo'yilgan pul │ Umumiy qiymat │ Kutilayotgan │ Sovg'alar │ ← current stock only (D6)
│  {invested}   │   {worth}     │  foyda       │           │
├────────────────────────────────────────────┤
│ Umumiy savdo │ Daromad │ Yig'ilishi kerak │ Sotilgan dona│
├────────────────────────────────────────────┤
│  Ko'p sotilgan (top 8 bar)   │  So'nggi sotuvlar (15)     │
├────────────────────────────────────────────┤
│  Sotuvchilar bo'yicha (was /stats): tile per seller       │ ← folded in, shown once
└────────────────────────────────────────────┘
```

**Fix (walkthrough §3.1):** `invested`/`worth` value **current unsold stock at
each shipment's own cost** (D6), not everything-ever-received at today's cost. No
number appears on both here and a separate Stats page — Stats is gone.

### 5.2 Mahsulotlar — the Stock Hub (the biggest change)

Products + Partiyalar + Taqsimlash unified into **one product-lifecycle screen.**
List view, then a per-product expanded panel:

```
┌ list ─────────────────────────────────────┐
│ [+ Yangi mahsulot]   ‹expiry strip + report›│
│  img  Atir №5   ‹Bor · 8 ta›   240k  [▾]    │
│  img  Loson     ‹Tugadi—yo'lda›  180k [▾]    │
└────────────────────────────────────────────┘

  ▾ Atir №5 expanded ───────────────────────────────────────
  ┌ Partiyalar (Pipeline A) ┐ ┌ Sotuvchilarda ┐ ┌ Pul ─────┐
  │ Iyul  20 ta  ‹Keldi 12›  │ │ Gulshan  3    │ │ Xarid 8$ │
  │ Avgust 30 ta ‹Yo'lda› [Keldi ▸]│ Adolat   2 │ │ Qiymat…  │
  │ [+ Partiya]              │ │ Bo'sh:   3    │ │          │
  └──────────────────────────┘ └───────────────┘ └──────────┘
  [ Taqsimlash ]   [ 📢 Kanalga post ]   [ ✏️ Tahrirlash ]
```

**Restock becomes a visible event, not a hidden number:**
1. `[+ Partiya]` adds a shipment with `Buyurtma`/`Yo'lda` status, qty, unit_cost,
   optional eta. Product shows `Yo'lda` (or `Tugadi — yo'lda` if it still had 0).
2. `[Keldi ▸]` — **one tap** when it lands → status `arrived`, `received_date =
   today` (D2), stock derived, storefront/seller flip to `Bor` automatically.
3. **No hand-edited "Jami soni".** Total is derived from arrived batches (D6); the
   drift warning is retired.

**Taqsimlash (distribute)** keeps its guards (no over-allocation, no below-sold,
reductions-first) but fixes its worst trap: the input is a **stepper pre-filled
with the current allocation, showing a live "+3 / −1" delta**, so "new total vs
add" is visible, not buried in grey text.

**📢 post is explicit (G5):** editing/discounting never auto-posts. Posting is a
button with a preview + confirm.

**Edit modal** keeps its rich media tooling (crop, AI description, YouTube finder,
result-image reorder). Add: a **Endi keltirilmaydi** (discontinue) action — sets
`discontinued_at`, drops it from the catalog (D3). Add a soft **archive** so
there's finally a way to retire a product (fixes "no delete anywhere").

### 5.3 Sotuvchilar (people)

Unchanged in structure (list → detail with the 5 gradient cards, per-product
rollup, recent sales, stock-adjustment form). Relabel money stations to §1.2.
Native `confirm()` in adjustments → inline confirm (G1).

### 5.4 Pul (money) — payments + giveaways

Payments screen unchanged in structure (KPIs, per-seller table, record-payment,
history) except: money vocabulary → §1.2; **"To'liq ✓"** and history trash use
the inline confirm (G1). **Giveaways** becomes a tab here ("Sovg'alar") — stock
that left for free, no money, no debt — since it's a money/stock-out concept, not
a top-level area.

### 5.5 So'rovlar (inbox) — keep prominent, keep the badge

Structure stays (allocation requests · price requests · returns watch-only ·
resolved history). The stock-bump `confirm()` on approval becomes an inline
confirm (G1). Resolutions fire the seller's 🔔 (§4.6) so she learns the outcome
immediately.

---

## 6. Build checklist (phased, with acceptance criteria)

Each phase is independently shippable. Ordered so nothing is built twice.

### Phase 1 — Grammar pass (no data changes) · unblocks everything
- [ ] G1 Replace **all** `window.confirm()` with the inline confirm card.
- [ ] G3 Swap every §1 "replaces" string to the canonical term (both apps).
- [ ] G6 `aria-label` on every icon-only button.
- [ ] G7 Key sale↔photo lookups on `product_id`.
- [ ] G8 Login: recovery link + distinct error messages.
- [ ] G2 Audit refresh model; convert SSR-reload writes to optimistic.
**Done when:** no native dialog remains; a term grep finds only canonical words;
renaming a product keeps its sale thumbnails; a mistyped login says which field.

### Phase 2 — Single stock signal (consumes D4, D5)
- [ ] Ship `v_product_availability` + `v_catalog` (D4/D5).
- [ ] Seller card: four signals → one `state` badge; pills → detail sheet.
- [ ] Storefront cards read `state`; retire the `Tez orada` section &
  un-run `v_upcoming`.
**Done when:** every card shows exactly one stock line; a customer can tell
`Tugadi` from `Tugadi — yo'lda`; no `v_upcoming` reference remains.

### Phase 3 — Seller IA (no data dependency)
- [ ] Nav → 4 tabs; Settings → ⚙; build 🔔 notification centre.
- [ ] Delete standalone sell grid; home card → 2-step sell.
- [ ] Success screen: full 10s undo, no auto-nav.
- [ ] Unify sale editing on Sotuvlar; remove home Tuzatish modal.
- [ ] Symmetric trust + audit rows (G4); "delete" → **Bekor qilingan**.
- [ ] Stock-detail sheet with "Boshqacha son oldim".
- [ ] Hisob relabel to Pipeline B; payment → 🔔.
**Done when:** requests are reachable in ≤1 tap via 🔔; there is exactly one sale
list and one sale editor; selling is 2 taps from a card; nothing is hard-deleted.

### Phase 4 — Admin Stock Hub (consumes D1, D2)
- [ ] Merge products+batches+distribute into the lifecycle screen.
- [ ] `[+ Partiya]` (Buyurtma/Yo'lda) and one-tap `[Keldi]` (D1/D2).
- [ ] Distribute input → pre-filled stepper with live delta.
- [ ] `📢 post` explicit with preview+confirm (G5); no side-effect posting.
- [ ] Add discontinue + archive.
**Done when:** a restock is done without editing any raw total; storefront flips
to `Bor` on `[Keldi]`; saving a discount never posts on its own; a product can be
retired.

### Phase 5 — Admin regroup + money truth (consumes D6)
- [ ] Nav → 5 areas; Giveaways into Pul.
- [ ] Merge dashboard+stats into Boshqaruv (numbers shown once).
- [ ] Flip stock to derived; retire drift; correct `invested`/`worth` (D6).
**Done when:** the admin nav has five grouped areas; no metric appears on two
pages; `worth`/`invested` reflect current stock and stop drifting upward.

### Phase 6 — Polish / optional
- [ ] Admin offline tolerance where used on phones (#19).
- [ ] Arrival waitlist ("xabar bering") if channel proves insufficient.
- [ ] `Keldi ✅` 72h "just arrived" flourish on cards.

---

## 7. One-line definition of done

A customer, a seller, and the admin all see the **same product lifecycle and the
same money lifecycle, named the same way**, on screens grouped by the decisions
each makes — with one confirmation pattern, one refresh feel, one vocabulary, and
no silent or irreversible surprises. When that's true, nobody has to *learn* the
app; they just read it.