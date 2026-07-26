# Stock reconciliation — running log

Goal: one true stock number (`remaining = max(0, arrived − sold)`) across admin, website and
seller app; restock only via partiya; retire the Yo'lda toggle; no negative stock.

Plan: `~/.claude/plans/purring-meandering-blossom.md`. Audit tool: `scripts/audit-stock.mjs`.

---

## Step 1 — Audit (read-only) ✅  2026-07-27

Saved `scripts/audit-stock.mjs`. Baseline (32 products):

```
TOTALS  products=32  no-partiya=25  neg-qoldi=2  web≠realR=22
```

Key facts:
- **25/32 products have no arrived partiya** — stock lives only in `total_qty`.
- Website "looks right" only via the fallback `received = arrivedSum OR total_qty`, so today
  `webNow = total_qty − sold`.
- **2 broken (NEG-QOLDI):** `🍊 WISELY Tangerine Vita-C kremi`, `[WISELY] Glow Oil Mist` —
  total 0, sold 5, incoming 5 → dashboard "Qoldi" = −5.
- **5 genuinely not-arrived** (Collagen PDRN, Sezgir Tishlar, Mild Brightening Peeling,
  milk parvarishi pastasi, Og'iz Spreyi): total 0, sold 0, incoming N → correct, leave alone.

Decision confirmed by data: backfill must run **before** the read-side switch (otherwise all
25 no-partiya products would read 0). Backfill target = `max(total_qty, sold)`.

---

## Step 2 — Backfill (data) ✅  2026-07-27

- `scripts/backfill-arrived-batches.mjs --commit` → inserted **27** arrived partiyalar
  (tag lot_label=`backfill`, note=`auto-reconcile`; revert with `--revert`).
- `scripts/sync-total-qty.mjs --commit` → synced legacy `total_qty` to arrived for the **2**
  wiped products (Glow Oil Mist, Vita-C kremi: 0 → 5), clearing the legacy −5.

Audit after: `no-partiya=0  neg-qoldi=0  web≠realR=0`. The 2 formerly-broken products now
read `sold_out_incoming` ("Tugadi — yo'lda"), remaining 0, incoming 5. Every product's
`realR == webNow`. Reversible via the two scripts' revert paths.

---

## Step 3 — Read side ✅  2026-07-27

- `src/pages/admin/products.tsx`: SSR + client refresh now select `remaining` from
  `v_product_availability`; the "Soni" column shows `max(0, remaining)` with a `+N yo'lda`
  chip. `total_qty` is no longer displayed.
- `src/pages/admin/index.tsx`: dashboard "Qoldi" now uses `remainingById` (from
  `v_product_availability`), clamped ≥ 0, instead of `v_product_stats.units_remaining`.

Data unchanged, so audit unchanged (`neg-qoldi=0 web≠realR=0`). Typecheck clean.

---

## Step 4 — Restock flow + retire toggle ✅  2026-07-27
`src/pages/admin/products.tsx`:
- Removed the Do'konda bor / Yo'lda toggle from the **edit** path (kept for new products).
- Edit modal no longer shows "Jami soni"; instead a read-only **Qoldi / Yo'lda** panel plus a
  **"Yangi partiya (yo'lda) qo'shish"** control that inserts an `in_transit` partiya
  (`addIncomingBatch`). «Keldi» on the Partiyalar page turns it into stock.
- New-product save now creates a partiya (arrived batch = Soni, or an in_transit batch) so no
  product is ever partiya-less. `total_qty` still written as a harmless mirror.

## Step 5 — Cleanup ✅  2026-07-27
`src/pages/admin/batches.tsx`: removed the `drift` / "mos emas" warning and the unused
`AlertTriangle` import; headline is now **Kelgan: N** (arrived), no longer `total_qty`.

## Step 6 — Verify ✅  2026-07-27
- Final audit: `products=32  no-partiya=0  neg-qoldi=0  web≠realR=0`.
- Glow Oil Mist & Vita-C kremi: total 5 / arrived 5 / incoming 5 / sold 5 → **Qoldi 0 · Yo'lda 5**
  (`sold_out_incoming`). No impossible values anywhere.
- `yarn test` 12/12; `tsc` clean (except a pre-existing recharts typing error in admin/index
  unrelated to this work); `yarn build` succeeds.

### Result
One true stock number (`remaining = max(0, arrived − sold)`) now drives Products "Soni",
dashboard "Qoldi", the website and the seller app. Restock is partiya-only. No negatives.
