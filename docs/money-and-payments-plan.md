# Money, Payments & Earnings — Full Analysis + Plan

> The single source of truth for how money flows in Camelia, what already works,
> what's confusing, and exactly what to build so **you** and **the sellers** both
> understand it. Written after auditing every related file + the live database.

---

## ⚡ UPDATE — audit done, critical bug found & fixed

Auditing every section against the live DB surfaced a **real bug** (not just clarity):

- **CRITICAL (fixed):** the seller `/seller/balance` page read `v_seller_balances`, which
  returns **balance = 0** for sellers. Root cause: `products` table RLS drifted to block
  sellers → cascades through every `security_invoker` view (`v_sales_enriched`,
  `v_inventory`, `v_seller_balances`). Sellers saw "you owe 0" while owing millions.
  - **Code fix (done):** balance page now reads `v_my_summary` (a definer view — correct).
  - **SQL root fix (you run once):** `docs/fix-products-rls.md` restores the products
    read policy so the underlying views are correct everywhere too.
- **Phase 1 (done):** payment history added — admin (`/admin/payments`, with delete +
  "To'liq" settle) and seller (`/seller/balance`, read-only). Verified end-to-end:
  recording a 1,000,000 payment drops the seller's "still owed" and appears in her history.
- **Phase 2 (done):** seller balance page redesigned — big green **"Sizning daromadingiz"**
  (her 40% earnings) separated from **"Topshirish kerak"** / **"Qolgan"**.
- **Phase 4 (started):** new money labels added to `src/consts/strings.ts`.

Remaining: Phase 3 (admin per-seller breakdown — partly covered by `/admin/sellers/[id]`)
and the open questions in §9.

---

## 0. TL;DR (read this first)

- **Good news:** the feature you asked for — "record money received from sellers, and
  know exactly how much is still owed *excluding their 40% profit*" — **already exists
  and the math is correct.** It's the `/admin/payments` page + the `balance` number.
- **The real problem is clarity, not capability.** The words are confusing ("qarz"/debt
  everywhere), sellers can't clearly see *their own earnings*, and there's **no list of
  past payments** — only a running total. People can't trust a number they can't trace.
- **This doc** explains the money model in plain language, maps what connects to what,
  and lays out a phased plan to make it crystal-clear for you and the sellers.

---

## 1. The money model in plain language

Every product has:
- **`retail_price`** — the price the customer pays (can be discounted per sale = `unit_price`).
- **`cost`** — what **you** (admin) paid the wholesaler for one unit. **Sellers never see this.**

When a seller sells 1 unit:

```
unit_price   = what the customer actually paid   (e.g. 250 000)
cost         = your wholesale cost                (e.g.  57 000)   ← hidden from seller
margin       = unit_price − cost                  = 193 000        ← the profit to split
seller_earns = margin × 40%                       =  77 200        ← seller keeps this
your_profit  = margin × 60%                       = 115 800        ← your cut
owed_to_you  = unit_price − seller_earns          = 172 800        ← seller hands you this
```

**The rule the seller must understand:**
> "I collect the full price from the customer. I **keep 40% of the profit**. I **hand the
> rest to Camelia (admin)**."

**The rule you (admin) must understand:**
> "For every sale, the seller owes me `unit_price − their 40% cut`. When they pay me
> cash, I record it. What's left is what they still owe."

---

## 2. Worked example with REAL data (GULSHAN, from live DB)

| Number | Value (so'm) | Meaning |
|---|--:|---|
| Total revenue (customers paid her) | 6 080 000 | sum of `qty × unit_price` |
| Total margin (profit to split) | 3 264 785 | revenue − wholesale cost |
| **Seller earns (40%)** | **1 305 914** | GULSHAN's own money — hers to keep |
| **Your profit (60%)** | **1 958 871** | your cut of the margin |
| **Owed to you** | **4 774 086** | revenue − seller's 40% = what she must hand over |
| Received so far | 0 | you've recorded no payments yet |
| **Still owed (balance)** | **4 774 086** | owed − received |

**Cross-check:** `owed_to_you = revenue − seller_earns` → 6 080 000 − 1 305 914 = 4 774 086 ✓
The system is internally consistent. When you receive, say, 4 000 000 from her, you record
it and the balance drops to 774 086.

---

## 3. Data model — what connects to what

### Tables (the raw facts)
| Table | Holds | Who writes it |
|---|---|---|
| `products` | name, `retail_price`, `discount_price`, **`cost`**, `total_qty` | admin |
| `allocations` | how many units each seller was given (`qty_allocated`) | admin (Distribute page) |
| `sales` | one row per sale: `seller_id`, `product_id`, `qty`, `unit_price` | **seller** (Sotildi) |
| `payments` | one row per cash hand-over: `seller_id`, `amount`, `note`, `paid_at` | **admin** (Payments page) |
| `profiles` | seller name, `commission_rate` (0.40), `opening_balance` | admin |

### Views (the calculated truth — never do money math in the app, read these)
```
sales ──┐
products┼─► v_sales_enriched   (per sale: revenue, margin, seller_profit, my_profit, owed_to_me)
profiles┘         │
                  ├─► v_seller_balances   (per seller: total_owed, received, balance)  ← ADMIN
                  │        ▲
        payments ─┘        │
                  └─► v_my_summary / v_my_sales / v_my_monthly  (same math, filtered to
                           the logged-in seller by my_profile_id())              ← SELLER
```

**Key insight:** `v_sales_enriched.owed_to_me` **already excludes the seller's 40%.**
`v_seller_balances.owed_from_sales` is just the sum of it. So:

- **"How much do I still need to receive from X?"** = `v_seller_balances.balance` for X.
- **"How much has X earned for herself?"** = sum of `seller_profit` (40% of margin).

Both numbers already exist. Nobody is surfacing the second one to the seller clearly.

---

## 4. Current state — what works, what's confusing

### ✅ Already works
- **Admin `/admin/payments`** — records a payment (`payments` insert) and shows a table
  with `total_owed`, `received`, `balance` per seller. This IS the "enter received money"
  feature. It's correct.
- **Balance math** — `balance = opening_balance + owed_from_sales − received`. Correct.
- **Seller home** — shows "Bu oy foydangiz" (this month's profit) from `v_my_monthly`.

### ⚠️ Confusing / missing (the actual work)
- **A. Debt-only framing.** Both the admin table and the seller `/seller/balance` page talk
  only about "qarz" (debt). A seller opening her balance sees what she *owes*, never a clear
  "**Siz shuncha ishladingiz**" (you earned this much). Feels punitive + hides her upside.
- **B. Seller earnings not surfaced on the balance page.** `v_my_summary.your_total_profit`
  exists but the balance page ignores it. The seller's 40% is invisible where she'd look for it.
- **C. No payment history.** Both sides see only a running `received` total. If you record
  4 000 000, neither you nor the seller can see *when* / *how much* / *what note*. No trust,
  no audit trail, no way to fix a mistake.
- **D. No confirmation loop.** Seller can't verify what you entered, so disputes are "he-said".
- **E. Terminology drift.** "owed_to_me", "owed_from_sales", "total_owed", "balance" — five
  debt-ish words, no plain labels. Easy to mix up margin vs. profit vs. owed.

---

## 5. The plan

Split into **Admin side** (you) and **Seller side** (them). Nothing here changes the money
math — it only surfaces numbers that already exist and adds a payment history.

### Phase 1 — Payment history (foundation, highest value)
The `payments` table already stores every payment; we just don't show them.

- [ ] **Admin:** on `/admin/payments`, add a "So'nggi to'lovlar" list under the form —
      date, seller, amount, note — newest first. Add a **delete** on a wrong entry.
- [ ] **Seller:** on `/seller/balance`, add "To'lov tarixi" — every payment YOU recorded
      for her (date + amount + note), so she can verify. Read-only.
- [ ] Data: just `select * from payments where seller_id = … order by paid_at desc`.
      (Sellers already have RLS read on their own payments per the schema.)

### Phase 2 — Seller earnings clarity (what she asked to see)
- [ ] Redesign `/seller/balance` into two clear blocks:
  1. **"Sizning daromadingiz"** (Your earnings) — big, friendly, green:
     `your_total_profit` (her 40%), + "Bu oy" (this month from `v_my_monthly`).
  2. **"Camelia'ga topshirish"** (To hand over) — `balance` (still owed), with
     `received` (already handed over) shown small beneath.
- [ ] Reword so it reads as: *"You earned X. You've collected the customers' money.
      Keep your 40%, hand Camelia the rest. Still to hand over: Y."*

### Phase 3 — Admin clarity + trust
- [ ] On `/admin/payments`, expand each seller row (or the detail page) to show the
      full breakdown: revenue, their 40%, **owed to you**, received, **still owed** —
      using the same labels as the seller sees, so you're both looking at one story.
- [ ] Add a "Mark fully settled" shortcut that records a payment equal to the current
      balance (optional convenience).

### Phase 4 — Terminology lock-in
- [ ] Put every money label in `src/consts/strings.ts` and use ONE consistent set:

| Concept | Uzbek label | English (admin) |
|---|---|---|
| customer paid | Sotuv summasi | Revenue |
| seller's 40% | Sizning daromadingiz | Seller earnings |
| owed to admin | Topshirish kerak | Owed to me |
| already handed over | Topshirilgan | Received |
| still owed | Qolgan | Balance / still owed |
| wholesale cost | — (NEVER shown to seller) | Cost |

---

## 6. Guardrails (do NOT break these)
- **Never show `cost`, `my_profit`, or `margin` to a seller.** Sellers see revenue, their
  own 40%, and what they owe — nothing about your buy price or your cut.
- **Never compute money in the app.** Always read the views. If a number is wrong, fix the
  SQL view, not the React.
- **Payments are admin-only writes.** Sellers can *see* their payments, never create them.
- **`owed_to_me` already excludes the 40%.** Don't subtract it again anywhere.

---

## 7. Implementation checklist (in build order)
1. [ ] Phase 1 admin payment list + delete (`/admin/payments`)
2. [ ] Phase 1 seller payment history (`/seller/balance`)
3. [ ] Phase 2 seller earnings redesign (`/seller/balance`)
4. [ ] Phase 3 admin breakdown per seller (`/admin/payments` or `/admin/sellers/[id]`)
5. [ ] Phase 4 move all labels into `strings.ts`
6. [ ] Verify end-to-end: record a payment → balance drops → seller sees it in history

## 8. Verification (after each phase)
- [ ] Record a test payment for GULSHAN of 1 000 000 → her `balance` drops from
      4 774 086 to 3 774 086, and it appears in both admin + seller history.
- [ ] Seller balance page shows her earnings (~1 305 914) separately from what she owes.
- [ ] No seller screen ever shows cost or admin profit (grep the seller pages).

## 9. Open questions (decide before building)
- [ ] When a seller sells at a **custom low price** below cost, margin goes negative → her
      40% is negative. Should earnings floor at 0, or reflect the loss? (Currently reflects it.)
- [ ] Do you want partial-payment receipts (a printable/screenshottable confirmation)?
- [ ] Should "Bu oy foydangiz" reset visually each month, or always show lifetime + this month?
- [ ] `opening_balance` (old debt at migration) — should it show to the seller, or only to you?
