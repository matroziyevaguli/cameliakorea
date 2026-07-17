# Camelia Korea — Growth & Customer-Facing Plan

> **The plan for turning Camelia from an internal management tool into a growth engine:**
> Instagram posting, promotions & giveaways, restock intelligence ("what & how much to buy
> next"), seller restock requests, a wholesale/bulk lead page, a content-request inbox, and
> a "price this product for me" concierge feature.
>
> This is a **planning document only** — nothing here is built yet. It says *what to build,
> why, how each piece works for both the admin and the customer, what data it needs, and the
> order to ship it in.* It builds on [`camelia-master-plan.md`](./camelia-master-plan.md)
> (the internal ops source of truth) — read that first for the money model and existing pages.
>
> _Written: 2026-07-16._

---

## Table of contents

0. [The big picture — what this turns Camelia into](#0-big-picture)
1. [Module 1 — Instagram posting (alongside Telegram)](#1-instagram)
2. [Module 2 — Promotions & Events (admin)](#2-promotions)
3. [Giveaway strategy — Instagram vs Telegram (my recommendation)](#giveaway-strategy)
4. [Module 3 — "Suggested next batch" (restock intelligence)](#3-restock)
5. [Module 4 — Seller product / restock requests](#4-seller-requests)
6. [Module 5 — Wholesale / bulk-price lead page (public)](#5-wholesale)
7. [Module 6 — Content requests ("ask Guli for content")](#6-content)
8. [Module 7 — Price inquiry for products we don't stock](#7-price-inquiry)
9. [The unifying idea — one "Requests/Inbox" spine](#unifying)
10. [Cross-cutting: identity, notifications, spam, i18n, delivery](#cross-cutting)
11. [Proposed data model (all new tables & views)](#data-model)
12. [Proposed pages & routes (admin / seller / public)](#pages)
13. [Phased rollout — what to build, in what order](#rollout)
14. [Decisions I need from you](#decisions)
15. [References](#references)

---

<a id="0-big-picture"></a>
## 0. The big picture — what this turns Camelia into

Right now Camelia is a **private back-office** (`/admin` + `/seller`). Your ideas add a
**public front-door** and a **marketing layer**. Grouped, they're really four new capabilities:

| New capability | Modules | Who it serves |
|---|---|---|
| **Broadcast** — publish to all channels at once | 1 (Instagram), + existing Telegram | You / sellers |
| **Grow** — promotions, giveaways, referrals | 2, 3 (strategy) | New & repeat customers |
| **Buy smarter** — what to restock & how much | 3, 4 | You + sellers |
| **Capture leads** — bulk, custom-price, content | 5, 6, 7 | The public |

The single most important design decision: **modules 5, 6, and 7 are all "someone on the
internet submits a request, you respond, they check back."** Build them on **one shared
"Requests" spine** ([§9](#unifying)) instead of three separate mini-apps — same table, same
public "check my request by code" page, same admin inbox, three different forms. That keeps
it simple to build and simple to run.

> **Guiding principle:** the public writes through **server API routes only** (validated,
> rate-limited), never directly into the database. Customers stay **anonymous** (a short
> **ticket code** like `CAM-7K3Q` lets them check status without an account). You reply from
> **one admin inbox**. Everything is bilingual (**Uzbek + English**).

---

<a id="1-instagram"></a>
## 1. Module 1 — Instagram posting (alongside Telegram)

**Goal:** the same one-tap "announce a product" you have for Telegram, but to your
**@cameliakorea** Instagram — ideally a single **"Post to all channels"** button.

### Why it's a good fit
- Your product images already live at **public Supabase Storage URLs**, and Instagram's API
  *requires* a public image URL — so no new upload step.
- You already have `buildCaption()` and the `/api/announce` server-route pattern — Instagram
  is a sibling route.

### What needs to change (file-level, no code here)
1. **New env vars** (in `.env.local` and your host): `IG_ACCESS_TOKEN`,
   `IG_BUSINESS_ACCOUNT_ID`, optional `IG_GRAPH_VERSION` (default a current Graph version).
2. **New API route** `src/pages/api/announce-instagram.ts` — does Instagram's **two-step
   publish**: (1) create a media container from `image_url` + `caption`, (2) publish it.
   Handle the "still processing" retry, and return a friendly Uzbek error on failure.
3. **Products page** (`src/pages/admin/products.tsx`) — in the existing announce panel add an
   **"Instagram'ga joylash"** button next to the Telegram one, and/or a **"Hammasiga
   joylash"** (Post to all) button that fires both. Track which platform is sending.
4. **Caption differences to respect:** Instagram links in captions are **not clickable**
   (put the video/contact as plain text), max ~2,200 chars, up to 30 hashtags. Add a small
   hashtag block for reach (e.g. `#skincare #koreanskincare #uzbekistan #camelia`).
5. **Auth + throttle** the announce routes (today `/api/announce` is open — see master plan
   P0). Only a logged-in admin/seller should be able to post.

### The one-time setup only you can do (account admin, not code)
This is the real gate. Instagram's API needs:
1. **@cameliakorea → a Business or Creator account** (free, in the IG app).
2. **Link it to a Facebook Page.**
3. A **Meta Developer app** requesting the `instagram_content_publish` permission → goes
   through **Meta App Review** (can take a few days).
4. Generate a **long-lived access token** (~60-day expiry; the app can auto-refresh it).

**Limits:** ~25 API posts / 24h (plenty). **Do not** use "unofficial" auto-posters that log
in as you — they violate Instagram's terms and risk a **ban**. Official API only.

> **Recommendation:** build the code now (gated on the env vars) so the moment your token is
> ready, the button works. Until then it shows "Instagram sozlanmagan" instead of failing.

---

<a id="2-promotions"></a>
## 2. Module 2 — Promotions & Events (admin)

**Goal:** a `/admin/promotions` page where you create campaigns and rewards — **without
having to give away physical products.** Post any promotion to Instagram + Telegram in one tap.

### The promotion "toolbox" (pick what fits each campaign)
All of these cost you **nothing until a sale happens**, and the reward comes out of **margin**
— so they're effectively self-funding:

| Mechanic | How it works | Cost to you |
|---|---|---|
| **Discount code** | `CAMELIA10` = 10% or 20 000 so'm off. Percentage or fixed, min-order, expiry, usage cap. | Only on redemption, from margin |
| **First-order discount** | Auto code for a customer's first purchase. | Margin, once per customer |
| **Referral reward** | "Invite a friend — you both get a code when they buy." Everyone becomes a promoter. | Margin, only on a real sale |
| **New-follower giveaway** | Follow + tag friends → win a discount code / free delivery. Grows followers. | ~0 (code) or 1 hero prize |
| **Loyalty points / tiers** | Earn points per purchase → redeem for discounts. Drives repeat buying. | Margin, deferred |
| **Bundle / set deal** | "Buy 3 sun sticks, get 15% off." Moves slow stock. | Margin |
| **Flash sale** | Time-boxed discount on chosen products, auto-expires. | Margin |

### Event triggers (your "if someone does X, reward them" idea)
A promotion can be **manual** (a code you hand out) or **triggered by an event**:

| Event | Trigger | Reward example |
|---|---|---|
| Joins the Telegram group / follows IG | new-follower giveaway entry | entry into the draw + welcome code |
| **Buys something** | a completed sale | loyalty points + "thanks" code for next time |
| **Refers a friend who buys** | referral code redeemed | code for the referrer |
| Birthday / first order | date / first-sale | one-time discount |

> **Reality check on triggers:** "someone joined the group" and "someone followed on IG" are
> **not** things the app can detect automatically without extra bot/webhook plumbing
> (Telegram bot as group admin can see joins; Instagram can't notify you of new followers via
> API). So: **Telegram-join → automatable** later via a bot; **IG-follow → handled as a
> giveaway with manual/entry-based verification**, not an automatic trigger. **"Buys
> something" → fully automatable** because the sale is already in your database.

### How it works — admin flow
1. `/admin/promotions` → **Yangi aksiya** (new promotion).
2. Choose type (code / referral / giveaway / bundle / flash), reward, limits, dates, channels.
3. Save → optionally **post to Instagram + Telegram** with an auto-built caption + the code.
4. Watch a **redemptions** list (who used it, how much discount given, sales driven).

### How it connects to money (important)
A redeemed code lowers `unit_price` on a sale, which already flows through your views — but
**the discount reduces margin, so it reduces both the seller's 40% and your 60%.** Decide
who "pays" for a promo discount (see [§14](#decisions)). Cleanest: the discount comes off the
**shared margin** (both bear it proportionally), which needs no special math.

---

<a id="giveaway-strategy"></a>
## 3. Giveaway strategy — Instagram vs Telegram (my recommendation)

You asked: run a **new-follower giveaway on Instagram, on Telegram, or both** — and **without
giving physical presents**. Here's the evidence-based answer.

**Do both, but with different jobs**, because each platform grows differently
([KickoffLabs][r1], [ShortStack][r2], [InviteMember][r3]):

- **Instagram = reach / new audience.** Accounts that run contests grow followers ~**70%
  faster** over three months. Best mechanics: **follow + like + tag 2 friends** (each tag =
  bonus entry, cap ~3), **share to Story** for extra entries, use a **Reel** + a
  **Collab post** with a partner to borrow their audience.
- **Telegram = depth / retention.** Best for rewarding people who **join the channel** and
  **share it**. Telegram has native giveaways, but those use paid Premium/Stars — skip those
  for a shop.

**The prize that needs no physical present** (this is the key move):

> Run a **"everybody wins" giveaway**: every valid entrant gets a **discount code + free
> delivery voucher**, and 1–3 random entrants win a **small product set** as the headline
> prize. The discount codes cost you **nothing until someone buys**, and then they come out
> of margin — so the giveaway **funds itself from the sales it creates**, while still growing
> followers. A single physical hero prize creates the "buzz," the codes convert the crowd.

**Even better — make it a referral giveaway:** entrants get a personal referral code; the more
friends who join with it, the more entries (and a bonus code when a friend *buys*). Now every
follower is a promoter and every reward is tied to a real sale ([IceKulfi][r4]).

**Rules to respect:** Instagram requires you to state the promo **isn't sponsored by
Instagram** and not to encourage inauthentic behavior (no "tag 50 people," no multiple
accounts). Keep entry simple; capture entries on a **landing page** (`/promo/[slug]`) so you
own the contact list, not just the comments.

**Concrete first campaign:** a 10-day Instagram+Telegram launch giveaway — grand prize one
K-beauty set, every entrant gets `WELCOME15` (15% off first order) + free delivery in
Namangan/Andijon/Farg'ona, referral bonus entries. Post it as a Reel + pinned Telegram
message via Module 1.

---

<a id="3-restock"></a>
## 4. Module 3 — "Suggested next batch" (restock intelligence)

> **Expanded:** this module is now fully specced — including **batch tracking, expiry
> management, FIFO costing, and expiration-driven promotions** — in
> [`inventory-intelligence-plan.md`](./inventory-intelligence-plan.md). The summary below is
> the restock-suggestion slice; see that doc for the complete Inventory Intelligence design.

**Goal:** an admin view that answers **"what should I buy next, and how many?"** from your
real sales — so you stop guessing and stop running out of your best sellers.

### The math (simple, proven retail formulas — [inFlow][r5], [ABC Supply Chain][r6])
For each product, from your own `sales` history:

```
avg daily sales      = units sold ÷ days on sale
days of stock left   = units remaining ÷ avg daily sales
lead time (days)     = how long a Korea reorder takes to arrive   (you set, e.g. 21–30)
safety stock         = (max daily sales × max lead) − (avg daily × avg lead)   ← buffer
reorder point (ROP)  = (avg daily sales × lead time) + safety stock
suggested order qty   = cover the next N days of demand (e.g. 60–90) − on-hand − already incoming
```

Then classify every product:

| Status | Rule | Action |
|---|---|---|
| 🔴 **Buy now** | remaining ≤ reorder point | reorder the suggested qty |
| 🟡 **Watch** | close to reorder point | plan for next batch |
| 🟢 **Healthy** | plenty of days of stock | do nothing |
| ⚫ **Dead stock** | no sale in X days | discount / bundle / stop reordering |

### How it works — admin flow
- `/admin/restock` (or a tab on Statistika) → a table sorted by urgency: product · avg/day ·
  remaining · **days left** · **suggested buy qty** · status.
- A **"next batch" summary**: total units and estimated **cost** to reorder everything red,
  so you know the money needed before you order.
- Optional **AI assist:** reuse your existing AI-route pattern to add a plain-language note
  ("Collagen is your #1 mover, ~9 days left, buy ~20").

### Data
A view `v_purchase_suggestions` computes all of the above from `sales` + `products` +
`allocations`. Lead time and target-cover-days are **settings** you can tune (a tiny
`settings` table or env). No new writes needed — it's pure analytics.

> This directly feeds **Module 4**: sellers' restock requests show up right next to the
> data-driven suggestion, so you buy the right amount for real demand.

---

<a id="4-seller-requests"></a>
## 5. Module 4 — Seller product / restock requests

**Goal:** let a seller **ask for more of a product** (especially **sold-out** ones) from her
phone — with a photo, a quantity, and whether she'll **pay in advance** — instead of texting
you separately.

### How it works — seller flow (`/seller/request`)
1. Tap **"Mahsulot so'rash"** (Request product).
2. Pick an existing product **or** describe a new one (name + **photo** + optional link).
3. Enter **how many** she wants.
4. Toggle **"Oldindan to'layman"** (I'll pay in advance) — signals commitment / priority.
5. Optional note → **Yuborish** (Submit). She sees status: *So'ralgan → Ko'rib chiqilmoqda →
   Tasdiqlandi / Rad etildi → Yetkazildi*.

### How it works — admin flow (`/admin/restock`, same page as Module 3)
- A **requests queue** next to the purchase suggestions, so demand from sellers and demand
  from the data sit side by side.
- Approve → it becomes part of your **next batch**; on arrival, one tap turns an approved
  request into an **allocation** for that seller (ties back to Distribute).
- "Pay in advance" requests can be flagged so committed stock is prioritized.

### Data
`restock_requests` table: `seller_id`, `product_id` (nullable for new items),
`proposed_name`, `image_url`, `qty`, `pay_in_advance` (bool), `status`, `note`,
timestamps. Sellers insert their own (RLS), admin updates status.

---

<a id="5-wholesale"></a>
## 6. Module 5 — Wholesale / bulk-price lead page (public)

**Goal:** a public page where someone who wants to **buy in bulk** submits which products and
quantities and **gets a wholesale price** — with **payment in advance** — and a multi-layer
way to contact you.

### How it works — customer flow (`/wholesale`, on the landing site)
1. Lands on a page that explains bulk buying + advance payment.
2. Picks products (from your catalog) and **quantities**, or free-text "what I want."
3. Enters contact (name + phone / Telegram username) and city.
4. Submits → gets a **ticket code** (`CAM-…`) and "we'll send your bulk quote."
5. Checks status any time at **`/track/CAM-…`** (no login) — sees the quote when you post it.

### How it works — admin flow
- Lands in your **inbox** ([§9](#unifying)) as a `bulk_quote` request.
- You set a **per-unit bulk price** and totals → status becomes **Quoted**.
- Customer sees it on their track page; if they accept, it becomes a **pre-order** (advance
  payment recorded).

### Multi-layer contact (your "contact will have multiple layers" idea)
A reusable **contact hub** component used across the landing site:
- **By city** → the right seller's phone (Namangan/Andijon/Farg'ona), pulled from config, not
  hardcoded.
- **By channel** → Telegram (@cameliakorea + DM), Instagram DM, phone, email.
- **By topic** → "Bulk order" routes to you; "Where's my order" routes to the seller; "Become
  a seller" routes to you. A simple dropdown that changes who/what it points to.

### Data
Uses the shared `inquiries` table (type `bulk_quote`) with a `line_items` JSON (product +
qty) and quote fields.

---

<a id="6-content"></a>
## 7. Module 6 — Content requests ("ask Guli for content")

**Goal:** your followers **write to you and request content** ("please review X", "how to use
retinol for oily skin") in **English or Uzbek**, and you create content from the queue.

### How it works — customer flow (`/content-request`, bilingual)
1. Language toggle **UZ / EN**.
2. Fields: their name/handle (optional), **skin type / concern** (dropdown), and the
   **request** (free text: "make a video about…").
3. Submit → ticket code + "rahmat, we read every request."
4. Optional: when you publish the content, they get notified (if they left a contact) and it
   appears on a public **"Siz so'radingiz — biz qildik"** (You asked, we made it) wall.

### How it works — admin flow
- A **content queue** in the inbox (type `content_request`), filter by language & concern.
- Mark **Planned → Published**, paste the Instagram/Telegram/YouTube link.
- The published wall doubles as social proof and SEO.

### Why it's strong
It turns followers into your **content calendar**, guarantees the content is what people
actually want, and the fulfilled wall is marketing in itself. Bilingual widens reach to both
Uzbek and international K-beauty audiences.

### Data
Shared `inquiries` table (type `content_request`) + `language`, `concern`, and a
`published_url` once done.

---

<a id="7-price-inquiry"></a>
## 8. Module 7 — Price inquiry for products we don't stock

**Goal:** a customer wants a skincare product you **don't stock** (or that's sold out). They
**submit a photo + request**, and you quote a **retail price including delivery fee**. They
check back later — **logged in or by ticket code** — to see the quote. This is a K-beauty
**"source anything for me"** concierge — a great lead magnet.

### How it works — customer flow (`/price-check`, on the landing site)
1. Submit: **product name/brand** + **photo** + optional link + **destination city**
   + contact (phone / Telegram).
2. Get a **ticket code** (`CAM-…`) + "we'll price it for you, usually within a day."
3. Come back to **`/track/CAM-…`** (no login needed) — or, if they're a registered
   customer later, a "My requests" list — to see: **retail price + delivery fee + total +
   availability**, and a **"Order / pay in advance"** button.

### How it works — admin flow
- Lands in the inbox as a `price_quote` request with the photo.
- You research the wholesale cost, set **retail price**, pick **delivery fee** (from a small
  city→fee table), optional note → status **Quoted**.
- If they order, it can become a **pre-order** (advance payment) and — if it becomes a
  regular item — a real `products` row.

### The "check without login" detail (your exact question)
Don't force accounts. Give every submission a **short human-friendly ticket code** (e.g.
`CAM-7K3Q`) shown on submit **and** sent to their contact. `/track/[code]` looks it up
(server API, **rate-limited**, no listing — you must know the code). If you *also* want logged-
in customers later, the same request can be linked to a customer account by phone. **Ship the
ticket-code version first — it needs no customer login system at all.**

### Data
Shared `inquiries` table (type `price_quote`) + `image_url`, `city`, `delivery_fee`,
`quoted_price`, `quoted_total`, `status`.

---

<a id="unifying"></a>
## 9. The unifying idea — one "Requests / Inbox" spine

Modules **5, 6, 7** (and the pre-order side of 4) are the same shape: *public submits → you
respond → they track by code.* **Build them once:**

- **One table `inquiries`** with a `type` column (`price_quote | bulk_quote |
  content_request`) + a flexible `payload` (JSON) for the type-specific bits.
- **One public submit API** per form (validated, rate-limited) that writes an `inquiries` row
  and returns a **ticket code**.
- **One public page `/track/[code]`** that shows status + your response for *any* type.
- **One admin `/admin/inbox`** that lists everything, filters by type/status/language, and
  lets you respond/quote. Badge counts of "new" per type.
- **One notification path** (Telegram DM to you on every new inquiry; notify the customer when
  you respond).

This is dramatically less to build and run than three separate systems, and it means **every
customer touchpoint lives in one place** you check daily.

---

<a id="cross-cutting"></a>
## 10. Cross-cutting concerns (get these right once)

- **Anonymous identity:** ticket codes (`CAM-XXXX`, short, unguessable-enough + rate-limited
  lookups). No customer login required for v1. Optionally add phone-based "my requests" later.
- **Spam & abuse:** all public forms go through **server API routes** with validation, a
  **honeypot field**, a simple **rate limit** (per IP + per phone), image type/size limits,
  and a max length. Never let the public write directly to the DB.
- **Notifications:** a **Telegram bot** DMs you on every new inquiry/request (cheap, instant);
  customers get status updates via the contact they left. This is what makes the whole thing
  feel alive instead of a form that goes nowhere.
- **Bilingual (UZ/EN):** extend the existing i18n pattern to the public pages; store the
  submitter's `language` so your reply and notifications match.
- **Delivery fees:** a tiny `delivery_zones` table (city → fee) so quotes are consistent; the
  contact-by-city routing reuses it.
- **Privacy:** you're now storing **customer contact info** — keep it to what you need, don't
  expose it publicly, and make the track page show only *that* request, never a list.
- **Moderation:** content requests and images are user-submitted — add a quick "hide/report"
  so nothing inappropriate ends up on the public "you asked, we made it" wall.
- **Keep the golden rules:** none of this changes the money model or shows sellers the cost.
  Public pages read a **safe public catalog view** (no `cost`), exactly like the storefront.

---

<a id="data-model"></a>
## 11. Proposed data model (all new tables & views)

Consistent with the existing Supabase style (RLS, `security_invoker`/`definer` views). Names
are suggestions.

| New table | Purpose | Who writes |
|---|---|---|
| `promotions` | campaigns: `type`, `code`, `discount_kind` (pct/fixed), `value`, `min_order`, `starts_at`, `ends_at`, `usage_cap`, `channels`, `status`, `terms` | admin |
| `promo_redemptions` | `promotion_id`, `sale_id`/`customer`, `amount_off`, `redeemed_at` | system/admin |
| `referrals` | `code`, `referrer` (handle/phone), `referred`, `rewarded_at` | system/admin |
| `giveaway_entries` | `promotion_id`, `platform`, `handle`, `referred_by`, `entries`, `created_at` | public API |
| `restock_requests` | `seller_id`, `product_id?`, `proposed_name`, `image_url`, `qty`, `pay_in_advance`, `status`, `note` | seller / admin |
| `inquiries` | **the spine:** `type`, `ticket_code`, `language`, `name`, `contact`, `city`, `image_url`, `payload` (JSON), `status`, `response`, `quoted_price`, `delivery_fee`, `quoted_total`, timestamps | public API (insert) / admin (update) |
| `delivery_zones` | `city`, `fee` | admin |
| `settings` | small key/value: `reorder_lead_days`, `target_cover_days`, contact numbers, channel handles | admin |

| New view | Purpose | Audience |
|---|---|---|
| `v_purchase_suggestions` | per product: avg/day, days-left, reorder point, suggested qty, status | admin |
| `v_promo_performance` | per promotion: redemptions, discount given, sales driven | admin |
| `v_public_catalog` | public product list **without cost** (for wholesale/landing pickers) | public |

> Contact numbers, channel handles, and the Telegram caption contacts should move **out of
> code** (they're hardcoded today) into `settings` so you can change them without a deploy.

---

<a id="pages"></a>
## 12. Proposed pages & routes

### Admin (new)
- `/admin/promotions` — create/run promotions & giveaways; post to IG+TG; redemptions.
- `/admin/inbox` — unified requests (price quotes, bulk, content) + reply/quote.
- `/admin/restock` — purchase suggestions (Module 3) **+** seller restock requests (Module 4).
- *(extend)* `/admin/products` — add Instagram / "post to all" buttons.

### Seller (new)
- `/seller/request` — request more stock / new products (image, qty, pay-in-advance).

### Public / landing (new)
- `/wholesale` — bulk-price request + advance payment.
- `/price-check` — "price this product for me" (image → quote).
- `/content-request` — bilingual content request form + "you asked, we made it" wall.
- `/track/[code]` — check any request by ticket code (no login).
- `/promo/[slug]` — giveaway / promotion landing pages (own the entry list).
- *(reused)* a **contact hub** component (multi-layer contact) on all of the above.

> These public pages are separate from the private `/admin` + `/seller` app and from the
> personal portfolio — treat them as the **Camelia storefront/landing** surface.

---

<a id="rollout"></a>
## 13. Phased rollout — what to build, in what order

Ordered by **value ÷ effort**, and so each phase is usable on its own.

### Phase 1 — Broadcast + first growth (quick wins)
- [ ] **Instagram posting** + "post to all channels" (Module 1) — small, high-visibility.
- [ ] Move hardcoded contacts/handles into `settings`.
- [ ] Secure & throttle the announce routes.

### Phase 2 — The Requests spine (unlocks 3 features at once)
- [ ] `inquiries` table + submit API + `/track/[code]` + `/admin/inbox` + Telegram notify.
- [ ] **Price-check** (Module 7) — the highest-value lead magnet.
- [ ] **Wholesale** (Module 5) on the same spine.
- [ ] **Content requests** (Module 6) on the same spine + the public wall.
- [ ] Multi-layer **contact hub** + `delivery_zones`.

### Phase 3 — Buy smarter
- [ ] `v_purchase_suggestions` + `/admin/restock` (Module 3).
- [ ] **Seller restock requests** (Module 4) on the same page → one-tap to allocation.

### Phase 4 — Promotions & giveaways
- [ ] `promotions` + discount codes applied at sale time (Module 2).
- [ ] Referral codes + `/promo/[slug]` landing + giveaway entries.
- [ ] Launch the **first Instagram+Telegram giveaway** ([§3](#giveaway-strategy)).
- [ ] Loyalty points (optional, later).

### Phase 5 — Automation & polish
- [ ] Telegram bot for **group-join** rewards + customer status DMs.
- [ ] "Buys something → reward" trigger wired to sales.
- [ ] Optional customer accounts (phone login) layered on top of ticket codes.

> **Suggested first two sprints:** Phase 1 (Instagram) then Phase 2 (Requests spine +
> price-check). That gets you posting everywhere *and* capturing leads fast — the two things
> that most directly grow the business — before the heavier promotions engine.

---

<a id="decisions"></a>
## 14. Decisions I need from you

Answer these and I can turn any phase into an executable build spec:

1. **Instagram setup:** can you do the Meta Business + Facebook Page + app-review steps? (Code
   is ready to build; it just needs your token.)
2. **Promo discounts — who absorbs them?** Off the shared margin (both you and the seller,
   proportional — simplest), or only your 60%? This changes the money math.
3. **Giveaway prize:** OK with the "everyone gets a discount code + free delivery, 1 hero
   product set as grand prize" model? Or truly zero physical prizes?
4. **Customer login:** ship **ticket-code only** first (recommended), or do you want phone-
   based customer accounts from day one?
5. **Reorder assumptions:** typical **lead time** for a Korea reorder (days), and how many
   **days of stock** you like to hold — so the "buy how many" math is tuned to reality.
6. **Delivery:** flat fee, or per-city fees? Which cities beyond Namangan/Andijon/Farg'ona?
7. **Where do the public pages live** — same domain as the portfolio (e.g. `/store`,
   `/wholesale`) or a separate Camelia domain?

---

<a id="references"></a>
## 15. References

- [How to Run a Successful Instagram Giveaway (KickoffLabs)][r1]
- [How to Run a Viral Instagram Giveaway in 2026 (ShortStack)][r2]
- [Growing with Telegram Giveaways, Stars & Boosts (InviteMember)][r3]
- [Instagram Giveaways That Grow Your Business, Not Just Followers (IceKulfi)][r4]
- [Reorder Point Formula & Safety Stock (inFlow)][r5]
- [Safety Stock Formula & Calculation (ABC Supply Chain)][r6]

[r1]: https://kickofflabs.com/blog/how-to-run-successful-instagram-giveaway/
[r2]: https://www.shortstack.com/blog/how-to-run-a-viral-giveaway-on-instagram-in-2026/
[r3]: https://blog.invitemember.com/growing-with-telegram-giveaways-stars-boosts/
[r4]: https://www.icekulfi.com/blogs/instagram-giveaway-strategy-guide
[r5]: https://www.inflowinventory.com/blog/reorder-point-formula-safety-stock/
[r6]: https://abcsupplychain.com/safety-stock-formula-calculation/
