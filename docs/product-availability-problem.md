# Problem — "Is this product actually in Uzbekistan right now?"

**Status: problem statement only. No solution chosen yet.**
Written so a solution can be designed against it. Nothing here is decided.

---

## 1. The problem in one paragraph

The same product is ordered from Korea **over and over**. One SKU is not a one-time
thing with a lifetime — it is a repeating cycle: *ordered → in transit → arrived in
Uzbekistan → distributed to sellers → sold out → ordered again*. Our data model has
no idea this cycle exists. It stores a single number per product, `total_qty`, and
everything (the storefront, the seller app, the money metrics) is derived from it. So
neither a customer on cameliakorea.com nor a seller in the app can answer the one
question that actually matters before someone promises a delivery date:

> **Is this product in Uzbekistan right now, or is it on its way?**

---

## 2. Why this hurts — concrete situations

**a) The customer cannot tell "gone forever" from "back next week".**
The landing page shows a product as `Tugadi` (sold out) with a grey overlay reading
"Hozircha mavjud emas". That is the same label whether the product is discontinued or
whether a new shipment lands on Thursday. A customer who wanted it just leaves.

**b) A seller promises what she does not have.**
The seller sees a product card with a count. She has no field telling her whether the
next shipment has physically landed, so she either promises a date she invented, or
calls the admin. Every restock generates the same round of phone calls.

**c) Restocking corrupts the history.**
Today a restock means an admin edits `total_qty` upward on the existing product row.
That single number now silently means "everything ever received, across all shipments".
Consequences:
- `remaining = total_qty − Σ sales` still works by luck, but nobody can answer
  "how many did the July shipment have?" without reading `product_batches`.
- `invested = Σ cost × total_qty` on the admin dashboard values **every unit ever
  received** at **today's cost**, including units sold months ago at a different cost.
- There is no "this product was out of stock for 3 weeks" fact recorded anywhere.

**d) An announced product has nowhere to live.**
A product that has been ordered but has not landed cannot be a `products` row: it has
no cost, no `total_qty`, no allocations, and would pollute seller inventory, the
distribute screen and every business metric with an empty row. So today it simply
cannot be shown to customers at all.

---

## 3. What the system knows today (facts)

| Thing | Where | What it means |
|---|---|---|
| `products.total_qty` | `products` table | Cumulative units received, all shipments. Edited by hand on restock. |
| `remaining` | `v_shop`, `v_my_inventory` | `total_qty − Σ sales`. `0` renders as `Tugadi`. |
| `product_batches` | `docs/batches-setup.md` | **Already exists.** One row per shipment: `quantity`, `expiry_date`, `received_date`, `lot_label`. Deliberately does *not* drive `total_qty` — it is an expiry/traceability layer only. |
| `v_batch_rollup` | same | Per-product `batch_qty`, `earliest_expiry`, `batch_count`. Admin UI already warns when `batch_qty ≠ total_qty` ("drift"). |
| allocations / sales | `allocations`, `sales` | Who holds what, what sold. |

**Key observation:** `product_batches.received_date` is the closest thing we have to
"this shipment arrived", but nothing reads it as an availability signal, and there is
no row at all for a shipment that has been *ordered but not yet received*.

---

## 4. Why `remaining` is not the answer

`remaining` collapses several genuinely different real-world states into one number.
`remaining = 0` currently means all of these at once:

- sold out, next shipment already ordered, arriving in ~2 weeks
- sold out, we intend to reorder but have not
- discontinued, never coming back
- never stocked yet — announced only
- arrived at the warehouse but not yet distributed to any seller

A customer needs to distinguish at least #1 from #3. A seller needs #5 (physically in
Uzbekistan) separated from #1 (not here yet). One integer cannot carry that.

---

## 5. The states that need distinguishing

Naming to use in the UI (Uzbek), per the request — the label belongs **on the product
card in the catalog**, not in a separate section:

| State | Customer-facing label | Meaning |
|---|---|---|
| In stock | `Bor` / current price badge | Arrived, units available |
| Low | `Kam qoldi` | Arrived, few left (exists today) |
| Sold out, restock coming | `Tugadi — yo'lda` | 0 left, a shipment is on the way |
| Not arrived yet | `Kelmadi` / `Yo'lda` | Announced or ordered, not in Uzbekistan |
| Arrived | `Keldi` | Shipment has landed (the transition customers want to hear about) |
| Discontinued | hidden or `Endi keltirilmaydi` | Not coming back |

Open: whether "arrived / not arrived" is a property of the **product** or of the
**shipment (batch)**. See §7.

---

## 6. Constraints any solution must respect

1. **Do not break `remaining`.** The seller app, `v_shop`, stats and the money views
   all derive from `total_qty − Σ sales`.
2. **Cost/profit stays server-side.** `v_shop` must never expose `cost`.
3. **Public read is via the anon key** — anything the landing page shows needs an
   RLS-safe view granted to `anon`.
4. **Admin effort is the real budget.** ~16 SKUs, run by a small team on phones. A
   solution requiring a status update per product per week will not be maintained.
   Whatever the design, arrival should be recorded **once per shipment**, not per product.
5. **Sellers must not be able to fake availability** — it drives customer promises.
6. `product_batches` already exists and is already in the admin nav ("Partiyalar").
   A solution that reuses it beats a solution that adds a parallel concept.

---

## 7. Open questions (the actual design decisions)

1. **Is arrival a product state or a shipment state?**
   If a shipment is a batch, "arrived" is `product_batches.received_date IS NOT NULL`
   and a product is available if it has ≥1 arrived batch with stock left. Then
   "ordered, not arrived" is just a batch row with a status of `ordered` and no
   `received_date`. Does that hold, or do we need a product-level override?

2. **Should `product_batches` become the source of truth for stock**, replacing the
   hand-edited `total_qty`? That fixes §2c permanently but touches every view. Or does
   it stay an independent layer with the drift warning?

3. **What does the customer actually see for "coming"?** A date (risky — customs), a
   vague window ("2 hafta ichida"), or just "yo'lda"? What has been promised on
   Telegram before, and what do customers accept?

4. **Who flips "arrived", and where?** Admin taps one button on the Partiyalar screen?
   Does it also need to notify sellers / post to the Telegram channel automatically?

5. **Do we need "notify me when it arrives"?** Right now the only mechanism is
   "subscribe to the Telegram channel". Is a per-product waitlist worth it, or is the
   channel enough?

6. **What happens to `invested` / `worth`** on the admin dashboard once units are
   tracked per shipment — should they value only *current* stock rather than
   everything ever received?

7. **Discontinued** — is there such a thing at Camelia, or is every product
   theoretically reorderable?

---

## 8. Candidate directions (sketches — none chosen)

Recorded only so the same ideas are not re-derived. Each needs to be checked against §6.

- **A. Status column on `products`** (`upcoming | in_stock | sold_out | discontinued`).
  Cheapest, but it is a second source of truth next to `remaining`, and someone has to
  keep it honest by hand — collides with constraint #4.

- **B. Extend `product_batches` with a lifecycle** (`ordered → in_transit → arrived`)
  and derive everything customer-facing from it. Reuses what exists (constraint #6),
  records arrival once per shipment (#4), and gives "yo'lda" a real meaning — a real
  shipment with a real quantity. Bigger change; needs a public view over batches.

- **C. Separate `upcoming_products` table** — what `docs/upcoming-products-setup.md`
  currently proposes. Keeps announcements fully clear of inventory, but a product that
  is announced and then arrives has to be re-created as a `products` row by hand, and
  the same SKU announced a second time means a second announcement row. Does not solve
  the recurring-cycle problem, only the first-launch case.

---

## 9. What is currently shipped that this supersedes

Commit `a65316c` added a separate **"Tez orada"** section on the landing page reading
from a proposed `v_upcoming` view (`docs/upcoming-products-setup.md`). Per the request,
that is the wrong shape: the signal belongs **on the product cards in the catalog** as
arrived / not arrived, not as a section of its own — because it is the *same* products
cycling, not a distinct set of future products.

**The `v_upcoming` SQL has not been run yet — do not run it until this is decided.**
The landing page fails soft without it, so nothing is broken in the meantime.
