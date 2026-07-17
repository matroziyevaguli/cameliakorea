# Research — How bigger platforms handle batch/lot tracking & expiration

Deep-research report (multi-source, adversarially fact-checked). Focus: what to adopt for
Camelia (~16 SKUs, Supabase, consignment) vs what's overkill.

## The core answer — how batches are differentiated over time
Every platform makes a **batch/lot a first-class record**, separate from the product. Each
batch carries **its own expiry date, quantity, and a batch/lot identifier** (manufacture
date + per-lot cost added in fuller systems like NetSuite). So one product has *many* batch
rows over time — that's how you tell an older shipment from a newer one. *(high confidence —
Zoho, NetSuite, Shopify BatchTrack/Batchly)*

## FEFO vs FIFO (the key concept)
- **FIFO** sorts by **arrival/receipt date**.
- **FEFO** (First-Expired-First-Out) sorts by **earliest expiry date**.
- Why FEFO exists: a batch that *arrived earlier* can *expire later* than a newer batch (e.g.
  manufacturing delays), so FIFO would sell the wrong one and leave you with soon-to-expire
  stock. FEFO is more data-intensive (needs expiry captured per batch). *(high confidence)*

## What the big systems do
- **NetSuite** — FEFO allocation for expiry-controlled items + **per-lot actual cost** (costing
  follows the exact batch sold). *(high)*
- **Odoo** — a **removal date = expiry − buffer days**; picks the nearest removal date so stock
  clears *before* it actually expires. *(high)*
- **Zoho** — records manufacture/expiry per batch and **auto-sorts batches first-expiring→last**
  during invoicing (a "sort-to-guide", not hard auto-allocation). *(high)*
- **Shopify SMB apps** — per-batch expiry, **threshold alerts (7/30/90-day)**, near-expiry
  dashboards, and **lot-to-order recall traceability**, even at low price points. *(high)*
- **Caveat** — many SMB tools (e.g. BatchTrack) **store expiry + alerts but do NOT do real FEFO
  picking or costing** — their "soonest-first" is display-only. Don't assume a badge = logic. *(high)*

## Regulatory drivers
Lot traceability matters because **MoCRA** now gives the FDA authority to order a **mandatory
cosmetics recall**; pharma has FDA-enforced expiry rules; cosmetics lose efficacy/safety past
expiry. Full recall workflows are overkill for Camelia now, but batch-level quantity gives you
basic traceability for free. *(high)*

## Recommendation for Camelia (~16 SKUs) — right-sized
**Worth adopting:**
1. A **`product_batches`** table: `product_id`, `expiry_date`, `quantity`, optional `lot_number`,
   `received_date` — replaces the single product-level expiry (keep `products.expiry_date` as a
   fallback/default).
2. **FEFO ordering** — sort a product's batches by `expiry_date ASC`. Zoho-style *sort-to-guide*
   is enough; hard auto-allocation is optional.
3. A **near-expiry report** — batches where `expiry_date <= now() + threshold` (mirrors the
   7/30/90-day filters). We already have the Telegram report; point it at batches.
4. Batch-level quantity → you can see **which seller's batch** is expiring (consignment fit).

**Overkill / defer:**
- Per-lot **actual costing** (NetSuite-grade) — unnecessary at 16 SKUs *unless cost per batch
  varies materially*. Our single `cost` is fine for now.
- Odoo-style **removal-date buffer** — nice-to-have, adds complexity.
- **Hard auto-FEFO allocation**, automated markdowns, formal multi-location/recall tooling.

**Incremental path:** (1) add `product_batches`; (2) sort batches FEFO by expiry; (3) near-expiry
report on batches; (4) later, per-lot cost only if buy prices swing between orders.

## Sources
Zoho Inventory KB (batch tracking, first-expiring-batch); NetSuite / Oracle NetSuite docs
(lot & FEFO allocation); Odoo 19 FEFO docs; Shopify apps BatchTrack, Batchly, SS Product
Expiration Dates; ASC Software & ShipBob (FEFO vs FIFO); FDA MoCRA guidance.
