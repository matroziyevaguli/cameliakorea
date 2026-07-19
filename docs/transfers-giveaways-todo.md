# Transfers + Giveaways — to-do (from `transfersandgiveawayssetup.md`)

Two features. Money math/views untouched; sellers never see cost/profit.

## SQL to run first (in `transfersandgiveawayssetup.md`, Part B)
- **B1** — extend `stock_adjustments`: add `'giveaway'` reason + `winner`, `channel` columns.
- **B2** — new `transfers` table + RLS + `approve_transfer(p_id)` RPC (atomic A→B move).
- **B3** — `v_giveaways` view (admin list).

## Phase 1 — Giveaways (Sovg'alar)  ✅ self-contained, build first
- [ ] **G1** Admin `/admin/giveaways` page: record form (product · from-seller · qty · winner ·
  channel · note) → inserts `stock_adjustments{reason:'giveaway'}`; list from `v_giveaways`.
- [ ] **G2** AdminNav: add **Sovg'alar** tab.

## Phase 2 — Returns / transfers between sellers (Qaytarish)
- [ ] **T1** `/api/transfer-request` — seller creates a transfer of UNSOLD units to another
  seller (default: main seller); inserts `transfers` row + Telegram ping to owner.
- [ ] **T2** `/api/resolve-transfer` — admin approve → `rpc('approve_transfer')` (called with the
  admin's own session so the RPC's `is_admin()` passes); reject → status update.
- [ ] **T3** Seller: **"♻️ Qaytarish"** in the product "⋯" sheet → qty (≤ remaining) + recipient
  → POST transfer-request; pending chip.
- [ ] **T4** Admin `/admin/requests`: a **Transfers** section (approve/reject), badge counts them.
- [ ] **T5** Seller **So'rovlarim**: show transfer requests + status.

## Guardrails (unchanged)
- Transfer never touches money (unsold units only). Giveaway never creates revenue/debt.
- Can't return/give away more than `remaining = allocated − sold − adjusted` (RPC enforces).
- `approve_transfer` keeps total allocated constant; `total_qty` never changes.
