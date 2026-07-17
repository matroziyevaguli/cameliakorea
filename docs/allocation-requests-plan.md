# Allocation Confirmation & Correction Requests — Plan

> Goal: make sure what a seller **actually received** matches what the admin **entered**.
> The initial distribution was typed by hand, so mistakes are likely. This adds a
> **seller-verifies / admin-approves** loop so both sides agree on stock — the consignment
> best-practice of *verify, don't blind-trust*. Planning only; no code here.

---

## 0. The problem in one line
The admin distributed products by hand (`allocations.qty_allocated`). The **seller** is the one
who physically holds the units, so **she** knows the true count — but today she has no way to
confirm or dispute it, and the admin has no way to know if the manual entry was right.

---

## 1. The core idea — one request/approval spine
Everything is the same shape: **seller submits → admin reviews → approve applies the change /
reject leaves it unchanged.** Three request *types*, one table, one admin inbox:

| Type | Seller says | On approve |
|---|---|---|
| **confirm** | "Yes, I really have N of this." | marks the allocation seller-confirmed (no qty change) |
| **correction** | "You gave me N, but I actually have M." | allocation qty → M |
| **new_product** *(phase 2)* | "A new product arrived — give me M." | creates an allocation of M |

The admin **always verifies before anything changes stock.** A seller can never silently alter
her own allocation.

---

## 2. Data model (new)

### `allocation_requests`
| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `seller_id` | uuid → profiles | the requester |
| `product_id` | uuid → products | |
| `type` | text | `confirm` \| `correction` \| `new_product` |
| `current_qty` | integer | what the system showed when she asked (context/audit) |
| `requested_qty` | integer | the qty she claims/wants (for `confirm` = current) |
| `reason` | text | seller's note ("2 tasi kelmadi", "yangi partiya keldi") |
| `status` | text | `pending` \| `approved` \| `rejected` (default pending) |
| `admin_note` | text | admin's reply on resolve |
| `created_at` | timestamptz | |
| `resolved_at` | timestamptz | |
| `resolved_by` | uuid | admin user_id |

### Optional lightweight confirmation flag on `allocations`
- `seller_confirmed_at timestamptz null` — set when a seller confirms that row is correct.
  Lets the admin see at a glance **which allocations are trusted vs still unverified**.

### RLS
- `allocation_requests`: seller inserts/reads **own** (`seller_id = my_profile_id()`); admin
  reads/updates all. Sellers may **not** update status (only admin approves).
- Applying an approved request (writing `allocations`) happens **server-side via an API route
  with the service key**, after the route re-checks the admin — so the seller can never write
  allocations directly.

---

## 3. Workflows (end to end)

### A. Confirm my stock (trust-building, the first win)
1. Seller opens **Mahsulotlar** → each product shows "Siz: N ta" with **To'g'ri ✅ / Xato ✏️**.
2. Tap **To'g'ri** → inserts a `confirm` request (or directly stamps `seller_confirmed_at` —
   see §8 open question). Admin sees a green "tasdiqlangan" mark.
3. This lets the admin true-up the manual entry: everything a seller confirms is trusted;
   anything unconfirmed is a to-do.

### B. Correction request (the fix path)
1. Seller taps **Xato** on a product → enters the **real quantity** + a short reason.
2. A `correction` request (status `pending`) is created; the allocation is **not** touched yet.
3. Admin sees it in **/admin/requests** with: seller, product, *current N → requested M*, reason.
4. Admin **Approve** → server sets `allocations.qty_allocated = M` (guarded, see §4) and stamps
   the request approved. **Reject** → unchanged, with an admin note.
5. Seller sees the outcome under **Mening so'rovlarim** (my requests).

### C. New-product self-assignment + photo receipt *(phase 2)*
The richer flow the owner described: sellers claim newly-arrived stock themselves, then
**prove receipt with a photo** where the units are countable.

1. **Admin announces arrival** — marks a product (or new batch) as "available to claim: N units".
   (Or a seller requests a product she doesn't have via **Yangi mahsulot so'rash**.)
2. **Seller self-assigns** — picks the product, enters how many she's taking (≤ available). This
   creates a `new_product` request (status `pending`).
3. **Admin approves the claim** (bounded by available stock).
4. **Seller receives the goods → uploads a photo** per product, laid out so the count is visible.
   Stored in Supabase Storage (reuse the `product-images` bucket); the request row gets
   `receipt_photo_url` + `received_qty`.
5. **Admin verifies by eye** — opens the photo, counts, confirms the number matches. Approve →
   the allocation is finalized at the verified qty. Mismatch → reject/adjust with a note.

**Why photo-proof:** it turns "did she really get N?" into visual evidence — the strongest
trust mechanism for consignment. Counting stays **manual (admin eyeballs it)**; no auto/AI
counting (unreliable on varied cosmetics, overkill at this scale).

Extra columns for this flow on `allocation_requests`: `receipt_photo_url text`,
`received_qty integer`, `available_qty integer` (context). Photo capture ideally at receipt
time; store `created_at` so an old photo can't be silently reused.

---

## 4. Guardrails / invariants (must hold)
- **Admin verifies everything.** No seller write ever changes `allocations` directly — only an
  approved request, applied server-side.
- **Sold-floor:** an approved correction can't set qty **below what she already sold**
  (`qty_allocated ≥ qty_sold`) — same rule as the Distribute page + the DB trigger.
- **Stock cap:** approving can't push Σ allocations for a product **over `total_qty`**
  (the existing `trg_alloc_within_stock` DB trigger enforces this).
- **One open request per (seller, product, type)** — block duplicates so the inbox stays clean.
- **Everything is a record** — requests are never deleted; they're approved/rejected. Combined
  with the current allocation, that's a full audit of who changed what and why.

---

## 5. UI — seller side
- **Mahsulotlar card:** add "Siz: N ta · To'g'ri ✅ / Xato ✏️". Xato opens a small form
  (real qty + reason).
- **Mening so'rovlarim** (new small page or a section on Hisobim): list of her requests with
  status badges (Kutilmoqda / Tasdiqlandi / Rad etildi) + the admin's note.
- Phase 2: **Yangi mahsulot so'rash** button.

## 6. UI — admin side
- **/admin/requests** inbox: pending first, filters by status/seller. Each row shows
  seller · product · **N → M** · reason · **[Approve] [Reject]** (+ optional note).
- A **badge count** of pending requests on the admin nav (like an inbox).
- Approve/Reject call a server API route (`/api/resolve-request`) that re-checks admin, applies
  the allocation change under the guards, and stamps the request.

## 7. Notifications
- **Admin** gets a Telegram DM on every new request (reuse `TELEGRAM_OWNER_CHAT_ID`):
  *"GULSHAN: Abib — 4→3 tuzatish so'radi."*
- **Seller** sees status in-app; optional Telegram later.

## 8. Audit & history
- The `allocation_requests` table *is* the audit trail for stock corrections (who, what, when,
  why, who approved). No extra logging needed. Deletions of allocations still hit `audit_log`.

## 9. Edge cases
- Seller requests a correction, then sells more before admin approves → re-check sold-floor at
  **approve time**, not submit time.
- Product's total stock already fully allocated → approving a raise is blocked (stock cap);
  admin must raise `products.total_qty` (new batch) first.
- Seller disputes down to a number she's already sold past → blocked with a clear message.
- Duplicate/spam requests → one-open-per-(seller,product,type) rule.
- Inactive seller → requests hidden / auto-closed.

## 10. How it connects to what exists
- **Allocations / Distribute** — the admin's manual path stays; this adds the seller-initiated
  path. Both obey the same sold-floor + stock-cap guards.
- **DB guards** — `trg_alloc_within_stock` and the sold-floor already protect the apply step.
- **Notifications** — reuses the low-stock Telegram plumbing (`TELEGRAM_OWNER_CHAT_ID`).
- **Stock adjustments** — different concept: adjustments = units *lost* (damaged/gift);
  corrections = the *original count* was wrong. Keep them separate.

## 11. Phased rollout
- **Phase 1 — BUILD NOW: edit/correction requests only.** Sellers already physically received
  their goods, so no self-assignment or photo-receipt is needed. The one real need is a way for
  a seller to say *"the number you entered for me is wrong — it's actually M"*, so the owner can
  see, check, and approve. This is mostly a **one-time true-up** of the hand-typed distribution,
  but the feature stays useful for every future hand-off, so it's worth keeping (it's small and
  low-risk — if you ever want it gone, the whole thing is one table + one page + one API route).
  - Includes: seller "Xato ✏️" correction form + optional one-tap "To'g'ri ✅" confirm;
    admin `/admin/requests` inbox with approve/reject under the sold-floor + stock-cap guards;
    Telegram ping to the owner on each new request.
- **Phase 2 — DEFERRED (not needed now): new-product self-assignment + photo receipt.** Only
  relevant when a *future* batch arrives that sellers haven't received yet. Skipped for now
  since everything on hand is already distributed.
- **Phase 3 — optional: batch-aware.** If we adopt `product_batches` (see
  `docs/research-batch-expiry.md`), a new-product request can target a specific batch.

## 12. Open questions (decide before building)
- **Confirm = a request the admin approves, or a one-tap self-serve stamp?** A self-serve
  "To'g'ri" (just sets `seller_confirmed_at`) is lighter and fine — confirming *doesn't change
  stock*, so it needs no approval. Disputes (`correction`) always need approval. *(Recommend:
  confirm is one-tap self-serve; correction needs approval.)*
- Should a correction **auto-apply** if it only *lowers* qty (seller admitting she got fewer)?
  Lowering is safe-ish but still best verified. *(Recommend: always verify.)*
- Do you want the seller to also **confirm at each new distribution** going forward (so every
  hand-off is two-sided), or only for the initial true-up?
- Notify the seller on Telegram when resolved, or in-app only?
