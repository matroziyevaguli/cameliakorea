# Camelia Korea — Master Management Plan

> **The single source of truth for how the Camelia Korea business app works** — for the
> owner (admin) *and* the sellers. It explains every page in plain language, the exact
> money model, the end-to-end workflows that keep both sides in agreement, the rules that
> must never break, and a prioritized roadmap to make the whole thing run smoothly and
> grow.
>
> This document covers **only the business-management app** (`/admin` + `/seller`). It does
> **not** cover the public portfolio pages or the public storefront.
>
> _Last written: 2026-07-16. Based on a full audit of the live code, the database views,
> and every existing doc in `/docs`._

---

## Table of contents

1. [What Camelia is (the 30-second version)](#1-what-camelia-is)
2. [The money model in plain language](#2-the-money-model)
3. [Who does what — roles & responsibilities](#3-roles)
4. [The whole app at a glance (site map)](#4-site-map)
5. [Admin pages — page by page](#5-admin-pages)
6. [Seller pages — page by page](#6-seller-pages)
7. [The 6 core workflows (end to end, no misunderstanding)](#7-core-workflows)
8. [The golden rules (invariants that must never break)](#8-golden-rules)
9. [One dictionary — locked terminology](#9-dictionary)
10. [What's missing / risky today (prioritized)](#10-gaps)
11. [Roadmap — suggestions to make Camelia most successful](#11-roadmap)
12. [Appendix A — data model reference](#appendix-a)
13. [Appendix B — how to know it's working (health checks)](#appendix-b)

---

<a id="1-what-camelia-is"></a>
## 1. What Camelia is (the 30-second version)

Camelia Korea is a small **K-beauty reselling business** in Uzbekistan. The owner
(**Gulchiroy / admin**) buys Korean skincare in bulk, then **gives stock on trust** to a
few **sellers** (currently GULSHAN, ADOLAT, SAIDA) who sell it to customers from their
phones. This is a **consignment model**: the owner still owns the goods until they're sold;
the seller keeps a cut of the profit and hands the rest of the cash back to the owner.

The app has exactly two private areas behind a login:

| Area | Who | Device | Job |
|---|---|---|---|
| `/admin` | Owner only | Desktop **and** phone | Buy products, hand out stock, watch the money, get paid |
| `/seller` | Each seller | **Phone-first** | See my stock, record what I sold, see what I earned and what I owe |

Everything else — the money math, who can see what — is enforced by the database
(Supabase Row-Level Security), so a seller can only ever see **her own** numbers.

---

<a id="2-the-money-model"></a>
## 2. The money model in plain language

This is the heart of the whole system. If everyone understands this one section, there are
**no arguments about money.**

### The one sentence each person must know

- **Seller:** *"I collect the full price from the customer. I keep **40% of the profit**.
  I hand the rest of the cash to Camelia."*
- **Owner:** *"For every sale, the seller owes me `full price − her 40% cut`. When she pays
  me, I record it. What's left is what she still owes."*

### The numbers on one sale

Say a seller sells **1 Abib Sun Stick**:

```
Customer pays (unit_price)     250 000     ← the seller collects this in cash
Owner's wholesale cost (cost)   57 000     ← HIDDEN from the seller, only the owner sees it
─────────────────────────────────────
Profit to split (margin)       193 000     = price − cost
Seller keeps (40%)              77 200     = margin × 40%   → "Sizning daromadingiz"
Owner keeps (60%)              115 800     = margin × 60%   → "Mening foydam"
─────────────────────────────────────
Seller hands to Camelia        172 800     = price − seller's 40%   → "Topshirish kerak"
```

**Cross-check that always holds:** `hand-over = full price − seller's 40%`
→ `250 000 − 77 200 = 172 800` ✓

### The running balance for a seller

```
Still owed (Qolgan)  =  opening debt  +  (sum of every sale's hand-over)  −  (payments received)
```

- **opening debt** (`opening_balance`) = money a seller already owed on the day we started
  using the app.
- Every recorded sale **increases** what she owes by the hand-over amount.
- Every payment the owner records **decreases** it.
- When it reaches **0**, they're square.

> **Critical rule:** the "hand-over / owed" number **already excludes the seller's 40%.**
> Never subtract the 40% again anywhere. The seller keeps her 40% *out of the cash she
> collected* — she does not get paid separately.

### Where the numbers come from (never re-calculated in the app)

All money math lives in **database views**. The app only ever *reads* them. If a number
looks wrong, fix the SQL view — never patch the math in React.

```
sales  ─┐
products┼─► v_sales_enriched   (per sale: revenue, margin, seller 40%, owner 60%, owed)
profiles┘        │
                 ├─► v_seller_balances   (per seller: owed, received, balance)   → ADMIN sees
        payments─┘        │
                 └─► v_my_summary / v_my_sales / v_my_monthly  (same math, auto-filtered
                          to the logged-in seller)                                → SELLER sees
```

---

<a id="3-roles"></a>
## 3. Who does what — roles & responsibilities

Clear ownership of each action is what prevents "I thought *you* did that."

| Action | Owner (admin) | Seller |
|---|:--:|:--:|
| Add / edit a product & its photos | ✅ | — |
| Set the wholesale cost & prices | ✅ | — |
| Hand out stock (allocate) | ✅ | — |
| **Record a sale** | ✅ (rarely) | ✅ **(main job)** |
| See the wholesale cost / owner's profit | ✅ | ❌ never |
| See her own 40% earnings | ✅ | ✅ |
| **Record a payment received** | ✅ **(only admin)** | ❌ (view only) |
| Set commission rate / activate-deactivate a seller | ✅ | — |
| Post a product to the Telegram channel | ✅ | ✅ |
| Change own password | ✅ | ✅ |

**The two write-actions that move money:**
- **Seller writes a `sale`** → increases what she owes.
- **Admin writes a `payment`** → decreases what she owes.

Everything else is either read-only or admin-only setup. This split is enforced by the
database, not just the UI.

---

<a id="4-site-map"></a>
## 4. The whole app at a glance (site map)

```
/login ─────────────► pick your name + password ──► redirected by role
   │
   ├── admin ──► /admin              Dashboard    (KPIs, best-sellers, recent sales)
   │            /admin/products      Mahsulotlar  (add/edit products, photos, Telegram)
   │            /admin/distribute    Taqsimlash   (hand stock to sellers)
   │            /admin/sellers       Sotuvchilar  (list, commission, active)
   │            /admin/sellers/[id]  (one seller's full breakdown)
   │            /admin/payments      To'lovlar    (the money hub: balances + record payment)
   │            /admin/stats         Statistika   (product & seller reports)
   │
   └── seller ─► /seller             Home         (earnings this month + my product cards)
                /seller/sell         Sotildi      (record a sale)  ★ most-used screen
                /seller/sales        Tarix        (my sales history)
                /seller/balance      Hisobim      (my earnings & what I owe + payment history)
                /seller/settings     Sozlamalar   (change password / log out)
```

**Navigation today:** admin uses a top bar of 6 pills; seller uses a 3-tab bottom nav
(Mahsulotlar / Tarix / Hisobim) plus a gear menu. See [§10](#10-gaps) for the mobile-nav fix.

---

<a id="5-admin-pages"></a>
## 5. Admin pages — page by page

Each page below is written so a new admin can sit down and *use* it, plus notes on what to
be careful of.

### 5.1 Dashboard — `/admin`
**What it's for:** a quick "how's business" glance the moment you log in.
**What you see:** 4 big cards (Revenue, My Profit, Outstanding, Units sold), a bar chart of
best-selling products, and a feed of recent sales.
**How to use:** just look. There's nothing to click.
⚠️ **Know this:** today the top cards are calculated from only the **last 20 sales**, so
they are *not* true all-time totals despite the label. For real totals use **Statistika**
or **To'lovlar**. (Fix planned — see [§10](#10-gaps).)

### 5.2 Products — `/admin/products` (Mahsulotlar)
**What it's for:** your product catalog — add new items, set prices, add photos, write
descriptions, and post to the Telegram channel.
**What you see:** a table of every product (photo, name, retail, discount, cost, quantity)
with an edit pencil and a 📢 Post button.
**How to use — add a product:**
1. Click **Yangi mahsulot**.
2. Fill **Nomi** (name), **Mahsulot narx** (retail), **Chegirma narx** (discount, optional),
   **Xarid narxi** (your wholesale cost), **Jami soni** (how many units you bought).
3. Upload a photo → crop it → optionally add gallery photos (drag to reorder).
4. Optionally click **✨ AI bilan yozish** for a description and **YouTube link topish** for
   a review video.
5. **Saqlash**.
**How to use — announce:** click 📢 **Post**, tweak the caption, **Telegram kanalga jo'natish**.
⚠️ **Know this:** `Xarid narxi` (cost) is secret — it drives all profit math and is **never**
shown to sellers. `Jami soni` here is the whole batch you bought; you hand it out on the
Distribute page. There is currently **no "delete product"** and prices aren't validated (a
discount can be typed higher than retail) — see [§10](#10-gaps).

### 5.3 Distribute — `/admin/distribute` (Taqsimlash)
**What it's for:** deciding **how many units of a product each seller currently holds.**
**What you see:** pick a product, then a row per seller with a number box, pre-filled with
what she has now, showing `hozir: N · sotildi: M` (has now / already sold). Top tiles show
**Jami** (total bought), **Taqsimlangan** (assigned), **Qoldi** (left to assign).
**How to use:**
1. Choose a product.
2. Set each seller's box to her **new total** (see the warning below).
3. **Saqlash**.
> ⚠️ **The #1 thing to understand:** the number you type is the seller's **new total**, not
> an amount you're adding. If she has 4 and you type 5, she now has **5** (not 9). To give
> her one more, type **5**. Set a box to **0** to take the stock back (only allowed if she
> hasn't sold any).
**Safety already built in:** you can't set a seller below what she already sold, and you
can't hand out more than you bought (`Qoldi` turns red).

### 5.4 Sellers — `/admin/sellers` (Sotuvchilar)
**What it's for:** the list of your sellers; adjust commission and active status; open a
seller's full detail.
**How to use:** tap a card to open her breakdown; tap the pencil to edit **Komissiya** and
**Faol** (active), then **Saqlash**. Deactivating hides a seller from Distribute and the
sale forms without deleting her history.
⚠️ **Know this:** commission is entered as a **fraction 0–1** (0.40 = 40%) — do **not** type
`40`. You currently **cannot create or rename a seller** or edit her opening debt from here
(done directly in Supabase). See [§10](#10-gaps).

### 5.5 Seller detail — `/admin/sellers/[id]`
**What it's for:** one seller's full story on a single screen.
**What you see:** 5 summary cards (Umumiy savdo / Foydasi / Qarzi / Topshirgan / Qoldiq
qarz), a per-product table (had / sold / left / revenue / profit), and her recent sales.
**How to use:** read-only. To act on what you see, go to **To'lovlar** (record a payment) or
**Taqsimlash** (change her stock). _Suggestion: add those buttons right here — see [§11](#11-roadmap)._

### 5.6 Payments — `/admin/payments` (To'lovlar)
**What it's for:** **the money hub.** See each seller's split, record cash you received, and
keep a payment history.
**What you see:** an explainer of the 40/60 split, 3 KPI cards, a per-seller table with
seven money columns (sold / her 40% / my 60% / to hand over / handed over / remaining), a
**record payment** form, and a **To'lov tarixi** (payment history) list.
**How to use — record a payment:**
1. In **To'lov qabul qilish**, pick the seller (her remaining balance is shown).
2. Enter **Miqdor** (amount) and an optional **Izoh** (note, e.g. "naqd, 5-iyul").
3. **To'lovni saqlash.** Her *Qolgan* drops immediately and the seller sees it in her app.
Or click **To'liq ✓** on a row to settle her whole balance in one tap.
⚠️ **Know this:** payments can be **deleted** with only a confirm dialog and no audit trail
— be careful, and always add a note so both sides can trace every payment. See [§10](#10-gaps).

### 5.7 Statistics — `/admin/stats` (Statistika)
**What it's for:** the real all-time reports.
**What you see:** a Sotildi-vs-Qoldi bar chart + product table (total / sold / left / revenue),
and a card per seller (owed / paid / remaining).
**How to use:** read-only reporting. These numbers are the trustworthy totals (unlike the
Dashboard's last-20 cards).

---

<a id="6-seller-pages"></a>
## 6. Seller pages — page by page

Written for a non-technical seller using a phone. Big buttons, few taps, plain words.

### 6.1 Home — `/seller`
**What it's for:** "how am I doing, and what can I sell?"
**What you see:** a greeting, **Bu oy foydangiz** (this month's earnings), two cards
(**Topshirilishi kerak** / **Topshirilgan**), a monthly-earnings chart, and a card for each
product you hold — with photos, price, stock (**Berilgan / Sotilgan / {n} ta qoldi**), and
buttons: **Sotildi**, **▶️ Videoni ko'rish**, **Telegram kanalga jo'natish**.
**How to use:** browse your products, tap **Sotildi** on the one you just sold. Use the gear
(⚙️) for password / logout.

### 6.2 Record a sale — `/seller/sell` (Sotildi) ★ the most important screen
**What it's for:** telling the system you sold something. **This is a seller's main job.**
**How to use:**
1. Pick the product (only ones you still have stock of appear).
2. Set **Soni** (quantity) with − / + (can't exceed what you have).
3. Pick the price: **To'liq narx** (full), **Chegirma narx** (discount), or **Boshqa**
   (custom) — the **Jami** (total) updates live.
4. Optionally add an **Izoh** (note).
5. **Tasdiqlash.** 🎉 You see the profit you just earned, then it returns home.
⚠️ **Know this:** there's no "are you sure?" step yet, and a wrong entry has to be fixed on
the **Tarix** page by deleting it. Type carefully. (A confirm step is planned — see [§11](#11-roadmap).)

### 6.3 My sales — `/seller/sales` (Tarix)
**What it's for:** review everything you've sold and fix mistakes.
**What you see:** totals (units + profit), a per-product summary, and every sale with its
profit and a 🗑️ delete.
**How to use:** search or filter by month. To fix a mistake, delete the wrong sale and
re-add it correctly on the Sotildi screen.
⚠️ **Know this:** delete is permanent and it changes what you owe — only delete genuine
mistakes.

### 6.4 My balance — `/seller/balance` (Hisobim)
**What it's for:** the honest answer to "how much did I earn, and how much do I owe?"
**What you see:** a big green **Sizning daromadingiz** (your 40% — yours to keep),
**Topshirilgan** / **Topshirish kerak**, a tap-to-expand breakdown (**Pul qanday
taqsimlanadi**), a **Qolgan** hero number, and **To'lov tarixi** (every payment the owner
recorded for you).
**How to use:** check your earnings and confirm every payment the owner entered matches what
you actually handed over. If something's off, tell the owner — the history is your receipt.

### 6.5 Settings — `/seller/settings` (Sozlamalar)
**What it's for:** change your password or log out. That's it.

---

<a id="7-core-workflows"></a>
## 7. The 6 core workflows (end to end, no misunderstanding)

These are the real journeys that cross the admin/seller boundary. Getting these to be
unambiguous is what "runs smoothly without any misunderstanding" actually means.

### Workflow 1 — New stock arrives → reaches a seller
1. **Admin** → Mahsulotlar → **Yangi mahsulot**: name, retail, discount, **cost**, quantity, photo.
2. **Admin** → Taqsimlash → pick product → set each seller's **new total** → Saqlash.
3. **Seller** opens Home → the product now appears with **{n} ta qoldi**.
✅ *Both sides now agree on who holds how much.*

### Workflow 2 — A sale happens
1. **Seller** sells to a customer, collects the **full cash**.
2. **Seller** → Sotildi → product, qty, price → Tasdiqlash.
3. System instantly: her **remaining** drops, her **earnings (40%)** rise, her **owed** rises.
4. **Admin** sees it in Dashboard's recent feed and in the seller's balance.
✅ *One tap keeps stock and money in sync for both sides.*

### Workflow 3 — Seller hands cash to the owner
1. **Seller** keeps her 40%, hands the rest to the owner (in person / transfer).
2. **Admin** → To'lovlar → select seller, enter amount + note → To'lovni saqlash.
3. **Seller** → Hisobim → sees **Qolgan** drop and the payment in **To'lov tarixi**.
✅ *The note + history is the shared receipt — no "did you pay me?" disputes.*
> **Rule:** only the **admin** records payments. The seller **confirms** them by checking her
> history. This one-writer / one-confirmer split is the anti-dispute mechanism.

### Workflow 4 — Fixing a mistaken sale
1. **Seller** (or admin) → Tarix → delete the wrong sale → re-add it correctly.
2. Balances recompute automatically.
⚠️ *Today this is a hard delete with no trace. Planned: a proper "return/correction" record
so history is never silently rewritten — see [§11](#11-roadmap).*

### Workflow 5 — Monthly settle-up
1. **Admin** → To'lovlar → read each seller's **Qolgan**.
2. Seller pays it down; admin records each payment (or **To'liq ✓** to clear it).
3. Both sides see **Qolgan = 0** and "Barakalla! Hisob-kitob tozalandi ✓".
✅ *A clean, shared zero is the definition of "settled."*
> _Suggestion: generate a one-tap monthly **statement / receipt** per seller — see [§11](#11-roadmap)._

### Workflow 6 — Onboarding a new seller
1. Create her login + `profiles` row (name, commission, opening debt) — **today done in Supabase.**
2. Link her auth account, set her active.
3. Distribute her first stock.
4. She logs in, sees her products, starts selling.
⚠️ *Today steps 1–2 need the database directly. Planned: an admin "Add seller" screen — see [§11](#11-roadmap)._

---

<a id="8-golden-rules"></a>
## 8. The golden rules (invariants that must never break)

Print these on the wall. Every future change must respect them.

1. **Never show a seller the `cost`, the owner's `margin`, or the owner's 60%.** She sees
   revenue, her own 40%, and what she owes — nothing about the buy price or the owner's cut.
2. **Never do money math in the app.** Always read the database views. Wrong number → fix
   the SQL view, not the React.
3. **`owed / to hand over` already excludes the 40%.** Never subtract it twice.
4. **Only the admin writes payments.** Sellers can *see* their payments, never create them.
5. **Stock can never go negative.** For every (seller, product): `allocated ≥ sold`, so
   `remaining ≥ 0`. Distribute enforces the floor; keep it that way.
6. **A seller only ever sees her own data.** This is enforced by database RLS, not by hiding
   UI. Never route seller reads through a table/view that leaks other sellers.
7. **One vocabulary everywhere.** Use the [dictionary](#9-dictionary) — never invent a new
   word for an existing concept.
8. **Financial records are precious.** Prefer *correcting* over *deleting*; every payment
   and correction should carry a note and, going forward, an audit trail.

---

<a id="9-dictionary"></a>
## 9. One dictionary — locked terminology

The biggest source of confusion today is that the same idea has several names (`qarz`,
`owed_to_me`, `total_owed`, `balance`…). **Pick one label per concept and use it everywhere**
— in the UI, in `strings.ts`, and in conversation. This is the "no misunderstanding" fix.

| Concept | Uzbek (canonical) | English (admin) | Who sees it |
|---|---|---|---|
| What the customer paid | **Sotuv summasi** | Revenue | both |
| Wholesale buy price | **Xarid narxi** | Cost | **admin only** |
| Profit on a sale (price − cost) | — | Margin | **admin only** |
| Seller's share (40%) | **Sizning daromadingiz** | Seller earnings | both |
| Owner's share (60%) | **Mening foydam** | Owner profit | **admin only** |
| Cash the seller must hand over | **Topshirish kerak** | Owed to owner | both |
| Cash already handed over | **Topshirilgan** | Received | both |
| Cash still to hand over | **Qolgan** | Balance / still owed | both |
| Debt carried from before the app | **Boshlang'ich qarz** | Opening balance | admin (seller: optional) |
| Seller's % of profit | **Komissiya** | Commission rate | admin |
| Units given to a seller | **Berilgan** | Allocated | both |
| Units still with the seller | **Qoldi** | Remaining | both |

> **Rule of thumb for sellers:** avoid the word **"qarz" (debt)** — it feels punitive and
> hides her upside. Frame it as **"Topshirish kerak"** (to hand over) next to a big, friendly
> **"Sizning daromadingiz"** (what you earned). She earned money *and* has some to hand over.

**Action:** move all admin labels into `src/consts/strings.ts` alongside the seller ones so
there's a single copy. Today the admin pages hardcode their own strings, which is how drift
starts.

---

<a id="10-gaps"></a>
## 10. What's missing / risky today (prioritized)

From auditing every page. Ordered by impact. **P0 = fix soon, P1 = important, P2 = polish.**

### P0 — correctness, money & security
- **`/api/announce` is unauthenticated & unthrottled.** Any anonymous POST can spam the
  shared public Telegram channel. → Require a logged-in session and rate-limit.
- **Dashboard KPIs are labeled "Total" but use only the last 20 sales.** They contradict the
  real totals on Statistika/To'lovlar. → Compute from full views or relabel "So'nggi 20 sotuv".
- **Payments & sales are hard-deleted with no audit trail.** A deleted, already-settled sale
  silently desyncs balances. → Soft-delete + an append-only log (see roadmap).
- **No stock guard against two phones selling the last unit.** The check is client-side only.
  → Enforce `remaining ≥ 0` in the database (trigger/constraint).

### P1 — clarity & missing capability (the "misunderstanding" risks)
- **No returns / refunds / exchanges.** A customer giving an item back has no home in the
  model — the only tool is deleting the sale, which rewrites history.
- **No damaged / lost / gifted stock.** If a unit breaks or a tester is used, `remaining`
  stays wrong forever and reconciliation drifts. → A "stock adjustment" record.
- **Seller can't confirm a payment or flag a dispute in-app.** She can only view. → An "I
  handed over X" note / acknowledge button closes the loop.
- **Money vocabulary still drifts** (English Dashboard vs Uzbek everywhere; `qarz` vs
  `Topshirish kerak`; admin strings hardcoded). → Adopt [§9](#9-dictionary) everywhere.
- **Can't create/rename a seller or edit opening debt in the UI.** → An "Add/Edit seller"
  admin screen.
- **Can't delete a product; prices aren't validated** (discount can exceed retail).
- **Distribute "replace vs add" still trips people up** despite the helper text.
- **Hardcoded seller names & phone numbers in `buildCaption`.** Wrong for anyone not listed,
  and stale on any change. → Pull contacts from config/profile.

### P2 — mobile, consistency, polish
- **Admin nav (6 pills) and Stats (`grid-cols-3`) aren't responsive** — cramped on a phone,
  and this is a phone-first business. → Hamburger / responsive grid.
- **Inconsistent refresh patterns** (some pages `router.replace`, some update state).
- **`v_admin_seller_products` view drifts** (`left` vs `remaining`) with fallback code that
  is really a "consolidate this view" TODO.
- **Raw English Supabase errors** shown to non-technical Uzbek users. → Friendly messages.
- **History has a 300-row cap, no pagination**; large amounts have no "are you sure?".
- **Duplicated settings entry points** (home gear vs Settings page); Sell/Settings lack the
  bottom nav.

---

<a id="11-roadmap"></a>
## 11. Roadmap — suggestions to make Camelia most successful

Grouped into phases. Each phase is shippable on its own and leaves the app more trustworthy
and easier to use. Grounded in both the audit above and **consignment best-practices** (clear
two-sided records, verify-don't-blind-trust, periodic statements, handle returns & shrinkage).

### Phase A — Trust & correctness (do first)
The foundation everything else rests on.
- [ ] **Audit trail + soft delete** for `sales` and `payments` (who / when / old→new). Nothing
      financial ever vanishes silently; mistakes are corrected, not erased.
- [ ] **Returns / corrections as first-class records** (a negative or `type='return'` row)
      instead of deleting a sale — so history stays honest and balances still reconcile.
- [ ] **Stock adjustments** (damaged / lost / gift / found) so `remaining` always matches
      reality. This is the consignment "reconciliation" pillar.
- [ ] **Database-level guards:** `remaining ≥ 0`, `Σ allocations ≤ total_qty`, discount ≤ retail.
- [ ] **Secure `/api/announce`** (auth + throttle) and move contacts out of code.
- [ ] **One vocabulary**: adopt [§9](#9-dictionary), move admin strings into `strings.ts`,
      Uzbek everywhere (fix the English Dashboard).

### Phase B — Clarity & self-service (make it obvious)
- [ ] **Add/Edit seller screen** (name, commission as a **%**, opening debt, active) — no more
      touching Supabase to onboard.
- [ ] **Confirm step on recording a sale** + friendly (Uzbek) error messages + a large-amount
      "are you sure?".
- [ ] **Seller payment acknowledgement:** she can mark "I handed over X" / confirm the owner's
      entry, turning the payment history into a two-sided agreement (best-practice: verify,
      don't blind-trust).
- [ ] **Actions on the seller-detail page** (record payment / adjust stock right there).
- [ ] **Distribute: an explicit "+ add" vs "set total" toggle**, or a per-seller "+1 / −1"
      stepper, to kill the replace-semantics confusion for good.
- [ ] **Responsive admin nav** (hamburger) + fix `grid-cols-3` for phones.

### Phase C — Statements, notifications & growth
- [ ] **Monthly statement / receipt per seller** — a screenshot-able "here's your month:
      sold X, earned Y, handed over Z, still owe W." Best-practice: eliminates the "what did I
      sell?" calls and builds trust.
- [ ] **Notifications:** Telegram/SMS to the owner on each sale and on **low stock**; to the
      seller when a payment is recorded. Cheap, high-trust.
- [ ] **Low-stock & dead-stock reports** for the owner (what to reorder, what isn't moving).
- [ ] **Date-range filters & one true "totals" source** shared by Dashboard / Stats / Payments,
      so the same number never appears three different ways.
- [ ] **A written consignment agreement** captured in-app on seller onboarding (commission,
      payout schedule, who covers damage/unsold) — the single biggest dispute-preventer in
      consignment businesses.

### Phase D — Nice-to-haves
- [ ] Per-payment editing; pagination on history.
- [ ] Pull-to-refresh; offline-safe sale recording (queue + retry).
- [ ] Customer/order light-CRM (repeat buyers, who bought what).
- [ ] Export to Excel/PDF for bookkeeping.

**Suggested first sprint:** Phase A's *audit trail + returns + stock adjustments + DB guards*,
then *one-vocabulary*. That single sprint removes almost every way the two sides can end up
disagreeing about money or stock.

---

<a id="appendix-a"></a>
## Appendix A — data model reference

### Tables (the raw facts)
| Table | Key columns | Written by |
|---|---|---|
| `profiles` | `full_name`, `role` (admin/seller), `commission_rate` (0–1), `opening_balance`, `active` | admin |
| `products` | `name`, `retail_price`, `discount_price`, **`cost`**, `total_qty` | admin |
| `product_images` | `product_id`, `url`, `sort_order` | admin |
| `allocations` | `seller_id`, `product_id`, `qty_allocated` (unique per pair) | admin (Distribute) |
| `sales` | `seller_id`, `product_id`, `qty`, `unit_price`, `sold_at`, `note` | **seller** (Sotildi) |
| `payments` | `seller_id`, `amount`, `paid_at`, `note` | **admin** (To'lovlar) |

### Views (the calculated truth — always read these)
| View | Grain | Surfaces | Audience |
|---|---|---|---|
| `v_sales_enriched` | per sale | revenue, margin, seller 40%, owner 60%, owed | admin |
| `v_inventory` | per seller+product | allocated, sold, remaining | admin |
| `v_seller_balances` | per seller | opening, owed, received, balance | admin |
| `v_product_stats` | per product | units sold, remaining, revenue | admin |
| `v_admin_seller_products` | per seller+product | had/sold/left/revenue/profit *(drifts — consolidate)* | admin |
| `v_catalog` | per allocated product | price, discount, image, gallery, description, link | seller |
| `v_my_inventory` | per product | had, sold, remaining | seller |
| `v_my_summary` | per seller (self) | your 40%, total owed, submitted, not submitted | seller |
| `v_my_sales` | per sale (self) | qty, price, revenue, **your_profit** (no cost/owner cut) | seller |
| `v_my_monthly` | per month (self) | profit + units per month | seller |

**Security model:** RLS — sellers read/write only their own `sales` and read their own
`allocations`/`payments`; admin does everything. Helper functions `is_admin()` and
`my_profile_id()`. Client uses the **anon key** (RLS protects data); the **service-role key**
lives only in `src/pages/api/*`, never in the browser. Seller-facing views are
`security definer` (they filter to `my_profile_id()`); do not route seller reads through the
base tables, which RLS blocks.

---

<a id="appendix-b"></a>
## Appendix B — how to know it's working (health checks)

Run these mentally (or as SQL) after any change to confirm nothing drifted:

- **Money is consistent:** for any seller, `owed = revenue − her 40%`, and
  `balance = opening + owed − received`. ✓
- **No negative stock:** `select * from v_inventory where qty_remaining < 0;` returns **0 rows**.
- **No over-allocation:** for every product, `Σ qty_allocated ≤ total_qty`.
- **Seller isolation:** logged in as a seller, she can see her own numbers and **zero** of any
  other seller's.
- **Cost is hidden:** grep the seller pages — no `cost`, `margin`, or owner-profit ever renders.
- **A recorded payment flows through:** record 1,000,000 for a seller → her **Qolgan** drops by
  1,000,000 and it appears in **both** the admin and seller payment history.

**The one-line definition of "running smoothly":** at any moment, the owner and every seller,
looking at their own screens, see **the same story about the same money** — what was sold,
what was earned, what was handed over, and what's still owed — with a note behind every number.
