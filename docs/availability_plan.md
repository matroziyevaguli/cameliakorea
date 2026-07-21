# Solution — "Is this product in Uzbekistan right now?"

**Status: proposed plan, ready to build.** Answers the problem statement in
`is-this-in-uzbekistan.md`. Nothing here runs until you say go; the shipped
`v_upcoming` SQL stays un-run and gets superseded (see §7).

---

## 0. The one idea

Stop treating a product as *a number*. Treat it as *a stack of shipments*.

`product_batches` already **is** that stack — one row per shipment, with
`quantity`, `received_date`, `lot_label`. It exists, it's already in the admin
nav ("Partiyalar"), and the problem statement's own §8 lands on it (Direction B).
We give each batch a **lifecycle** (`ordered → in_transit → arrived`), and then
*every* customer- and seller-facing availability signal is **derived** from the
batches. No hand-maintained status. Arrival is recorded **once per shipment**,
with one button, by the admin — satisfying the real budget constraint (§6.4).

This is Direction B, taken to its conclusion: batches become the source of
truth for stock, which also permanently fixes the corrupted-history problem
(§2c) and the "announced product has nowhere to live" problem (§2d).

---

## 1. Decisions taken (with the alternative, so you can veto)

| # | Decision | Why | If you'd rather |
|---|---|---|---|
| 1 | **Batches become the source of truth for stock.** `total_qty` stops being hand-edited and becomes *derived* from arrived batches. | Kills drift and fixes `invested`/`worth` for good (§2c). | Keep `total_qty` hand-edited and use batches only for the availability badge. Smaller diff, but §2c stays broken. Phase 3 is the only part you'd drop. |
| 2 | **Customer sees plain `Yo'lda`** for incoming — no date. | Customs makes any date a promise you can miss (§7.3). | Store an internal `eta` on the batch and show a soft window ("2 hafta ichida"). The field is in the schema either way; it's a one-line UI toggle. |
| 3 | **Telegram channel, no per-product waitlist** in v1. | Zero new build; ship the core fix first (§7.5). | Add `arrival_subscriptions` later — the arrival event that would trigger it already exists in this design, so it bolts on cleanly. |
| 4 | **Add a `discontinued` flag.** | Lets dead SKUs be hidden instead of sitting as eternal `Tugadi` (§7.7). | Skip it; every product stays reorderable. One nullable column, cheap to keep. |
| 5 | **"Arrived" is a shipment (batch) property, not a product property** (§7.1). | A product is available iff it has ≥1 arrived batch with stock left. "Ordered, not here" is just a batch with no `received_date`. No product-level override needed. | — (this one's structural; the rest of the plan assumes it) |

---

## 2. Data model changes

All additive first, so nothing breaks mid-migration.

### 2.1 `product_batches` — add a lifecycle + cost

```sql
-- lifecycle
alter type ... ;  -- or a text check
alter table product_batches
  add column status text not null default 'arrived'
    check (status in ('ordered','in_transit','arrived','cancelled')),
  add column ordered_date  date,        -- when we placed the order
  add column eta           date,        -- internal only, never public
  add column unit_cost     numeric;     -- per-shipment cost (enables the invested fix)

-- existing rows are real, landed stock → they are 'arrived' (the default).
-- backfill received_date where missing so the invariant below holds.
update product_batches set received_date = coalesce(received_date, created_at::date)
  where status = 'arrived' and received_date is null;
```

**Invariant (enforced by a trigger):** `status = 'arrived'  ⇔  received_date IS NOT NULL`.
Flipping to arrived stamps `received_date = today` if unset; you cannot be
arrived without a date, and a date implies arrived.

### 2.2 `products` — add discontinued, plan to derive total_qty

```sql
alter table products
  add column discontinued_at timestamptz;   -- null = live
```

`total_qty` is **not dropped yet** (§6.1 — half the app reads it). In Phase 3
it becomes derived. Until then it keeps working exactly as today.

### 2.3 The derived numbers (one view, computed, not stored)

```sql
create or replace view v_product_availability as
select
  p.id,
  -- received = sum of ARRIVED batch quantities (the honest "how much landed")
  coalesce(sum(b.quantity) filter (where b.status = 'arrived'), 0)      as received_qty,
  -- incoming = ordered or in transit, not yet here
  coalesce(sum(b.quantity) filter (where b.status in ('ordered','in_transit')), 0) as incoming_qty,
  b_arrived.next_arrival,          -- earliest received_date of arrived batches (for "Keldi")
  b_incoming.soonest_eta           -- internal, earliest eta of incoming batches
from products p
left join product_batches b on b.product_id = p.id
...
group by p.id;
```

Then, combining with sales (unchanged `remaining` math, §6.1 respected):

```
remaining      = received_qty − Σ sales           -- IDENTICAL formula to today
incoming_qty   = Σ ordered/in_transit batch qty
state =
  discontinued_at is not null                    → 'discontinued'
  received_qty = 0 and incoming_qty > 0          → 'not_arrived'      (Kelmadi / Yo'lda)
  remaining <= 0 and incoming_qty > 0            → 'sold_out_incoming'(Tugadi — yo'lda)
  remaining <= 0 and incoming_qty = 0            → 'sold_out'         (Tugadi)
  remaining <= low_threshold                     → 'low'             (Kam qoldi)
  else                                           → 'in_stock'         (Bor)
```

This is the whole §5 table, produced from data, maintained by nobody.

---

## 3. Making batches the source of truth (the §2c fix)

Once every product has at least one `arrived` batch (guaranteed by the 2.1
backfill), `total_qty` is redundant. Two safe steps:

**Step A — prove equivalence.** You already have the drift warning
(`v_batch_rollup.batch_qty ≠ total_qty`). Run the backfill, then drive drift to
zero for all ~16 SKUs. When drift is zero everywhere, `received_qty` and
`total_qty` are provably identical, so switching the source changes no number.

**Step B — flip the source.** Point `v_shop` / `v_my_inventory` /stats at
`received_qty` instead of `products.total_qty`. Keep `products.total_qty` as a
**generated column** mirroring `received_qty` for one release so any missed
reader still works, then drop it. Drift warning becomes obsolete and gets
removed.

**Money views, corrected (§2c, §7.6):** value only *current* stock, per shipment.

```
worth    = Σ over arrived batches of (units still unsold in that batch) × price
invested = Σ over arrived batches of (units still unsold in that batch) × batch.unit_cost
```

Consume sales against batches **FIFO by received_date** to get "units still
unsold in that batch". This is the only genuinely new computation; if you want
to defer it, an interim `invested = remaining × latest_unit_cost` is already
strictly better than today's "everything ever received at today's cost".

---

## 4. The public surface (§6.2, §6.3)

One RLS-safe view granted to `anon`, cost never present:

```sql
create or replace view v_catalog as
select
  p.id, p.name, p.image_url, p.price,
  a.state,                         -- the enum from §2.3
  (a.state in ('in_stock','low'))            as buyable,
  (a.incoming_qty > 0)                       as restock_coming,
  case when a.state = 'not_arrived' then true else false end as announced_only
from products p
join v_product_availability a on a.id = p.id
where p.discontinued_at is null;    -- discontinued drop out of the catalog
-- NO cost, NO unit_cost, NO seller data. grant select to anon.
```

The landing page reads `state` and renders the §5 label **on the product card**
— not in a separate section. This is the correction called for in §9: same
products cycling, badge on the card, `Tez orada` section retired.

Card rendering:

| state | badge | buy button |
|---|---|---|
| `in_stock` | price / `Bor` | active |
| `low` | `Kam qoldi` | active |
| `sold_out_incoming` | `Tugadi — yo'lda 🚚` | disabled, "kanalga obuna" |
| `not_arrived` | `Yo'lda` (or `Kelmadi`) | disabled, "kanalga obuna" |
| `sold_out` | `Tugadi` | disabled |
| just flipped to arrived | `Keldi ✅` (time-boxed, e.g. 72h) | active |

`Keldi` is a nicety: show it when the newest arrived batch's `received_date` is
within N days — the "arrived!" moment customers want, with zero extra state.

---

## 5. Admin & seller workflow

**Announcing a product that hasn't landed (§2d solved):**
Create the `products` row normally + add a batch with `status = 'ordered'`,
a quantity, and a cost. Because `received_qty = 0`, it shows as `Yo'lda` in the
catalog and is **excluded** from seller inventory, the distribute screen and
money metrics (all of which filter `received_qty > 0`). No empty row pollution.

**A shipment lands — the one action (§6.4):**
On the Partiyalar screen, the ordered/in-transit batch has a single
**"Keldi" (Mark arrived)** button. Tapping it:
1. sets `status = 'arrived'`, stamps `received_date = today`;
2. stock appears automatically (derived), card flips to `Bor`/`Keldi`;
3. optionally posts to the Telegram channel (§6, one tap or auto).

That's the *entire* per-shipment admin cost. Nothing per-product, nothing weekly.

**Restocking an existing SKU** is the same flow: add a new batch (a real
shipment with a real quantity and its own cost), mark it arrived. History stays
intact because each shipment is its own row — you can now answer "how many did
the July shipment have?" and "what did it cost?" (§2c gone).

**Anti-fake (§6.5):** batch `status` transitions are gated to admin role in RLS.
Sellers can read availability but cannot create or arrive a batch, so they can
never invent stock to promise a customer.

---

## 6. Constraint check (§6)

| Constraint | How it's met |
|---|---|
| 6.1 Don't break `remaining` | Formula unchanged: `received_qty − Σ sales`. During migration `received_qty == total_qty` (drift = 0), so numbers are identical. |
| 6.2 Cost stays server-side | `v_catalog` selects no cost column; `unit_cost` lives only on batches, exposed only to admin views. |
| 6.3 Public read via anon | `v_catalog` is the single anon-granted, RLS-safe view. |
| 6.4 Admin effort | Arrival recorded once per shipment via one button. No per-product, no recurring status upkeep. |
| 6.5 Sellers can't fake | Batch status transitions are admin-only in RLS. |
| 6.6 Reuse `product_batches` | The whole design is that table plus a `status` column. No parallel concept; the rejected `upcoming_products` table (Direction C) is not built. |

---

## 7. What this supersedes (§9)

`v_upcoming` / the `Tez orada` section (commit `a65316c`,
`docs/upcoming-products-setup.md`) is the wrong shape and is retired:

- **Do not run** the `v_upcoming` SQL (it's still un-run; nothing breaks).
- Remove the `Tez orada` section from the landing page; the signal moves onto
  the product cards as the `state` badge.
- `docs/upcoming-products-setup.md` → mark deprecated, pointing here.

An announced product no longer needs a separate table or a hand re-creation
when it lands: it's the same `products` row whose `ordered` batch you mark
`arrived`. The recurring cycle (§1) is modeled directly — each loop is a new
batch on the same product.

---

## 8. Build order (each step ships independently)

1. **Migration A — additive.** Add `status`/`ordered_date`/`eta`/`unit_cost` to
   `product_batches` (default `arrived`), add `products.discontinued_at`, add the
   arrival-invariant trigger, backfill `received_date`. Nothing visible changes.
2. **Availability view.** Ship `v_product_availability` + the `state` logic.
   Still no UI change; verify `state` matches reality for all 16 SKUs.
3. **Public `v_catalog` + card badges.** Landing page reads `state`; retire
   `Tez orada`. This is the customer-visible win (§2a).
4. **Admin Partiyalar: statuses + "Keldi" button.** Add-ordered-batch and
   mark-arrived flows. Seller/announce filters (`received_qty > 0`). This is the
   seller/admin win (§2b, §2d).
5. **Flip source of truth.** Drive drift to zero, repoint stock views to
   `received_qty`, make `total_qty` generated, then drop it. Correct
   `invested`/`worth` to current-stock/per-batch-cost (§2c, §7.6).
6. **(Optional, later) Telegram auto-post on arrival; per-product waitlist.**

Steps 1–4 deliver the entire customer + seller experience. Step 5 is the
accounting cleanup. Step 6 is polish.

---

## 9. Verification before each cutover

- **Step 2:** for all 16 SKUs, assert derived `state` equals the current
  human read of that product. Any mismatch is a data-cleanliness bug, caught
  before customers see it.
- **Step 3:** confirm `v_catalog` exposes no `cost`/`unit_cost` (grep the view
  def + test with the anon key). Confirm a `not_arrived` product renders on the
  card, not in a section.
- **Step 5:** run the drift report → must be zero everywhere before repointing.
  Snapshot `remaining` for every SKU before and after the source flip; the two
  lists must be identical. Recompute `invested` old vs new and eyeball the
  delta (it *should* drop — that's the bug being fixed, not a regression).
```