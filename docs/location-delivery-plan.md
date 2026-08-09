# Delivery location & address — Plan

Goal: a customer anywhere in Uzbekistan can give a usable delivery address at checkout, and the
order routes to the right seller.

---

## 1. Administrative structure (what to list)

Uzbekistan = **12 regions (viloyatlar) + Toshkent shahri + Qoraqalpogʻiston Respublikasi = 14
top-level divisions.** The checkout region dropdown lists all 14:

Toshkent shahri · Toshkent viloyati · Andijon · Buxoro · Farg'ona · Jizzax · Xorazm · Namangan ·
Navoiy · Qashqadaryo · Qoraqalpog'iston · Samarqand · Sirdaryo · Surxondaryo

Below the region, one **free-text address** field captures tuman (district) / mahalla / koʻcha /
uy / moʻljal (landmark). We do **not** enumerate ~200 tumans in dropdowns — couriers confirm by
phone, and free text is faster and less error-prone.

---

## 2. Do we need a map (Google vs open-source)?

**Recommendation: no map for now.** A region dropdown + a good free-text address is how most
Uzbek shops collect delivery info, and the courier calls to confirm. A map only earns its keep if
we want the customer to **drop a pin** or get **address autocomplete** — nice, but not required to
ship, and it adds cost, an API key, billing, and privacy surface.

If/when we do add a pin or autocomplete, the options ranked for **this** use case:

| Option | Coverage in UZ | Cost | Verdict |
|---|---|---|---|
| **Yandex Maps/Geocoder** | **Best** for UZ/CIS (street-level, local names) | Free tier + key | Best if we want accurate pins/autocomplete here |
| **OpenStreetMap + Leaflet** (+ Nominatim) | Decent, improving | **Free, no key** | Best if we just want a free pin-drop, no billing |
| **Google Maps/Places** | Good | **Requires billing account**, per-load charges | Only if already invested in Google; overkill/cost here |

**My call:** skip maps for the MVP. If a pin is later requested, use **Leaflet + OSM** (free, no
billing) for a simple pin, or **Yandex** if we need real UZ address autocomplete. Avoid Google —
its billing/cost isn't justified for a region + text address flow.

---

## 3. Order routing (unchanged, just more regions)

`api/orders/create` already resolves the seller by region: a seller whose `city` matches the
chosen region delivers; otherwise it falls back to **Gulshan (default)**. Today sellers are in the
Fergana valley (Namangan/Andijon/Farg'ona); orders from other regions go to Gulshan/central until
more sellers are added. No code change needed — just more region values.

---

## 4. Implementation

- **Now:** expand `src/consts/geo.ts` to all 14 divisions; relabel the picker "Shahar" → "Viloyat"
  in checkout, seller settings, and admin/sellers. (Export names `CITIES`/`CITY_LABEL` kept to
  avoid churn — they now hold regions.)
- **Address field:** already free-text; update its placeholder to prompt tuman/ko'cha/uy/mo'ljal.
- **Later (optional, only if requested):** pin-drop via Leaflet+OSM or Yandex autocomplete; a
  per-region tuman list if couriers want structured districts.

---

## 5. Verify
- Checkout shows all 14 regions; selecting any lets the order complete.
- A seller whose region matches gets the order; others fall back to Gulshan.
- Existing data safe: no orders/sellers currently use the old slugs.
