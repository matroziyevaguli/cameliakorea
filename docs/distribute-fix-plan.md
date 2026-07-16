# Distribute (Taqsimlash) — Fixing Mistakes: Analysis + Plan

> How product distribution works today, every way it can go wrong, and a safe plan to
> let the admin correct mistakes without corrupting inventory. Written after auditing
> `src/pages/admin/distribute.tsx`, the `allocations` model, and the live DB.

---

## ✅ IMPLEMENTED (Phases 1–2)

Done and verified against live data:
- **Boxes pre-fill** with each seller's current allocation; each shows **"hozir: N · sotildi: M"**.
- Label makes it explicit: the number is the **new total (replaces)**; **0 removes** the allocation.
- **Floor guard:** cannot set a seller below what they've already sold — blocked inline with
  *"{name}: {sold} ta sotilgan — kamaytirib bo'lmaydi"* (verified: 13 real rows would be blocked,
  e.g. GULSHAN/Aromatica alloc=5 sold=2 can't go below 2). `remaining` can never go negative.
- **Zero-removes:** setting a zero-sold allocation to 0 deletes the row (verified example:
  SAIDA/Aromatica sold=0 → removable); the freed units return to "bo'sh"/unallocated.
- Over-allocation guard (Σ ≤ total_qty) recomputed live; "Qoldi" turns red if exceeded.
- Client-side refresh after save (no `router.replace` crash).

Still open: **Phase 3** (a dedicated "Hozirgi taqsimot" inline edit/remove list — the current
page already lets you edit any seller inline, so this is now optional polish) and **Phase 4**
(DB-level guard + audit log). See §8 open questions.

---

## 0. TL;DR

- Today you **can't see** what each seller already has when distributing — the boxes are
  blank — so it's easy to double-assign or overwrite by accident.
- The save is an **upsert that REPLACES** the number (not adds), but nothing on screen says
  so. Type "2" for someone who has 4 → they silently drop to 2.
- **You cannot remove an allocation** (setting 0 is ignored), and there's **no way to edit
  existing allocations** directly.
- **Dangerous:** there is **no guard** stopping you from setting an allocation *below what the
  seller already sold*, which makes `remaining` go **negative** and corrupts inventory + the
  "unallocated" math. (DB only checks `qty_allocated >= 0`.)
- The plan below makes distribution **show current numbers, edit safely, remove cleanly, and
  never go below sold.**

---

## 1. How it works today

- `allocations` table: one row per `(seller_id, product_id)` with `qty_allocated`. Unique on
  that pair.
- Distribute page: pick a product → type a qty per seller → Save.
- Save does: `upsert(rows, { onConflict: 'seller_id,product_id' })` → **overwrites** the
  existing row's `qty_allocated` with the typed value.
- Inputs are **blank** (placeholder "0"); sellers with 0 typed are **filtered out** (so you
  can't zero/remove).
- `remaining = qty_allocated − qty_sold` (from `v_inventory` / `v_my_inventory`).

**Confirmed from DB:** admin **can** UPDATE and DELETE allocations (RLS allows it), so all
the fixes below are possible with no schema change. But there is **no constraint** preventing
`qty_allocated < qty_sold`.

---

## 2. Every mistake scenario (and what happens now)

| # | Mistake | What happens today | Severity |
|---|---|---|---|
| 1 | Gave qty to the **wrong seller** | Wrong seller keeps it; no easy undo; can't see it to fix | High |
| 2 | Typed **wrong number** (e.g. 15 not 5) | Overwrites silently; over-allocates the batch | High |
| 3 | Thought input **adds**, it **replaces** | Seller's real qty is clobbered | High |
| 4 | Want to **remove** an allocation | Impossible — 0 is ignored, no delete | Medium |
| 5 | **Reduce** allocation below what's **already sold** | `remaining` goes **negative**, inventory corrupts | **Critical** |
| 6 | Distributed to a now-**inactive** seller | Row lingers; not shown on page (only active sellers listed) | Low |
| 7 | No record of **who changed what** | No audit trail | Low |

---

## 3. Data model / connections (what a fix touches)

```
products.total_qty ──┐
                     ├─► "unallocated" = total_qty − Σ allocations   (Distribute page math)
allocations ─────────┘
       │
       └─► v_inventory / v_my_inventory:  remaining = qty_allocated − qty_sold
                                                          ▲
                                          sales (seller's Sotildi) ─┘
```

**The invariant that must never break:** for every `(seller, product)`,
`qty_allocated ≥ qty_sold` (so `remaining ≥ 0`). Any edit/remove must respect this.

---

## 4. The plan

### Phase 1 — Show the truth (make mistakes visible)  ★ do first
- [ ] On the Distribute page, when a product is picked, **pre-fill each seller's box with
      their CURRENT `qty_allocated`** (not blank).
- [ ] Under each box show a tiny hint: **"sotildi: N"** (already sold) so you see the floor.
- [ ] Change the header stat "Taqsimlangan" to update **live** as you edit.
- [ ] Label the action clearly: **"Yangi qiymat (ustiga yoziladi)"** = "New value
      (replaces)", so it's obvious the number is the new total, not an addition.

### Phase 2 — Safe edits (the guard)  ★ critical
- [ ] Block saving any seller where **new qty < that seller's `qty_sold`** for the product.
      Show inline: *"{name}: {sold} ta sotilgan, kamaytirib bo'lmaydi"*.
- [ ] Keep the existing over-allocation guard (Σ new ≤ total_qty), computed against the
      **new** values.
- [ ] Allow **0** to mean "remove": if new qty is 0 **and** `qty_sold` is 0 → **delete** the
      allocation row. If `qty_sold > 0` → block with the message above.

### Phase 3 — Direct correction UI
- [ ] Add a **"Hozirgi taqsimot"** (current allocations) list per product: each seller with
      allocated / sold / remaining + an inline edit and a **remove** (trash) button that
      obeys the same floor guard. This is the fast path for "fix one mistake."
- [ ] Client-side refresh after save/remove (no `router.replace(router.asPath)` — that caused
      the earlier "hard navigate" crash; use the same state-refresh pattern as Payments).

### Phase 4 — Optional hardening
- [ ] **DB safety net (recommended):** a trigger or check so the DB itself refuses
      `qty_allocated < qty_sold`. Belt-and-suspenders behind the app guard. (SQL doc.)
- [ ] **Audit log:** small `allocation_log` table (who/when/old→new) if you want history.

---

## 5. Guardrails
- Never let `qty_allocated < qty_sold` (Phase 2 app guard + Phase 4 DB guard).
- Never let Σ allocations for a product exceed `products.total_qty`.
- Removing = delete the row **only** when nothing sold; otherwise block, don't silently keep.
- No money math here — distribution is units only. (Sales/earnings are unaffected.)

## 6. Build checklist
1. [ ] Phase 1 — pre-fill current qty + sold hints + live "Taqsimlangan"
2. [ ] Phase 2 — floor guard (< sold) + over-allocation guard + 0-removes
3. [ ] Phase 3 — "Hozirgi taqsimot" list with inline edit/remove + client refresh
4. [ ] Phase 4 (optional) — DB check + audit log

## 7. Verify (after building)
- [ ] Pick a product a seller has sold from → their box shows current qty + "sotildi: N".
- [ ] Try to set it below N → blocked with a clear message; `remaining` never goes negative.
- [ ] Set a zero-sold allocation to 0 → row removed, "unallocated" goes back up.
- [ ] Fix a wrong-seller mistake: remove from A, add to B → totals stay consistent.
- [ ] No negative `remaining` anywhere: `select * from v_inventory where qty_remaining < 0;`
      returns 0 rows.

## 8. Open questions
- [ ] When you reduce an over-allocation, should the freed units auto-return to
      "unallocated" (they do — it's just `total_qty − Σ`), or do you also adjust `total_qty`?
- [ ] Do you want the audit log (Phase 4), or is live-correct state enough?
- [ ] Should inactive sellers with leftover allocations show up here so you can clear them?
