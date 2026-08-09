# Ordering + survey — build log

Implements `docs/ordering-and-survey-plan.md` (v2). One entry per phase step.

---

## Phase 0 — Foundations ✅  2026-08-09

**DB (owner runs):** `docs/ordering-phase0-setup.md`
- `profiles`: + `city`, `card_number`, `card_holder`.
- new `product_tags(product_id, tag_type, tag_value)` + index + RLS (public read, admin write).
- Verify + rollback blocks included. **Admin UI below stays inert until this SQL is run.**

**Code**
- `src/consts/skincare.ts` — skin types + concerns taxonomy (Uzbek labels), shared by admin + survey.
- `src/consts/geo.ts` — cities (Namangan/Andijon/Farg'ona/Boshqa).
- **0a** `src/pages/admin/sellers.tsx` — edit form gains **Shahar / Karta raqami / Karta egasi**;
  collapsed row shows a city chip + "Karta bor/yo'q". SSR + reconcile select the new columns.
- **0b** `src/pages/admin/products.tsx` — product form gains **Teri turi** + **Muammolar** chip
  multiselects; tags load on edit and save via delete-all-then-insert into `product_tags`.

**Verify:** `tsc` clean · `yarn build` compiles (`/admin/sellers`, `/admin/products`).
Pending owner action: run the Phase 0 SQL, then set seller cards/cities and tag the catalog.

### Coverage note (from plan §0b)
After tagging, run the "buyable but untagged" query in the setup doc — those products are invisible
to the survey. Decide the fallback (plan §1 Phase 1) before Phase 1 ships.

---

## Next: Phase 1 — Survey (`/tavsiya`), rule-based matching (pending Phase 0 SQL + some tags to test against).
