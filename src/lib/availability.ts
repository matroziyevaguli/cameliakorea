// The single stock vocabulary (redesign.md §1.1), shared by the storefront, the
// seller app and the admin app so all three say the same word for the same thing.
//
// `state` is computed in the DB by v_product_availability (docs/availability-migration-setup.md).
// Until that migration is run — or for any row that predates it — `stateOf()` derives
// the same answer from `remaining` alone. The two agree for every case except the ones
// that need shipment data (`not_arrived` / `sold_out_incoming`), which simply don't
// appear yet. That means this ships safely either way.

export type ProductState =
  | 'in_stock'
  | 'low'
  | 'sold_out'
  | 'sold_out_incoming'
  | 'not_arrived'
  | 'discontinued'

export const LOW_THRESHOLD = 2   // matches the DB view and the old orange badge

export function stateOf(p: {
  state?: string | null
  remaining?: number | null
  /** Seller view (`v_catalog`) exposes the count… */
  incoming_qty?: number | null
  /** …the public view (`v_shop`) exposes a boolean instead. Accept either. */
  restock_coming?: boolean | null
}): ProductState {
  // Prefer the database's answer — it knows about shipments.
  const s = p.state
  if (s === 'in_stock' || s === 'low' || s === 'sold_out' ||
      s === 'sold_out_incoming' || s === 'not_arrived' || s === 'discontinued') {
    return s
  }
  // Fallback: pre-migration behaviour, derived from stock alone.
  const remaining = p.remaining ?? 0
  const incoming = (p.incoming_qty ?? 0) > 0 || p.restock_coming === true
  if (remaining <= 0) return incoming ? 'sold_out_incoming' : 'sold_out'
  if (remaining <= LOW_THRESHOLD) return 'low'
  return 'in_stock'
}

/** Can a customer buy it right now? */
export const isBuyable = (s: ProductState) => s === 'in_stock' || s === 'low'

/** Customer-facing label. `low` and `in_stock` carry the count, so they're functions. */
export const STATE_LABEL: Record<ProductState, string> = {
  in_stock:          'Bor',
  low:               'Kam qoldi',
  sold_out:          'Tugadi',
  sold_out_incoming: "Tugadi — yo'lda",
  not_arrived:       "Yo'lda",
  discontinued:      'Endi keltirilmaydi',
}

/** Badge colours. One signal, one colour, in all three apps. */
export const STATE_STYLE: Record<ProductState, string> = {
  in_stock:          'bg-green-100 text-success',
  low:               'bg-orange-100 text-warning',
  sold_out:          'bg-red-100 text-danger',
  sold_out_incoming: 'bg-sky/20 text-sky',
  not_arrived:       'bg-lavender/25 text-lavender',
  discontinued:      'bg-gray-100 text-muted',
}

/** Seller-side label — she cares about her own count, so `Bor` becomes "N ta qoldi". */
export function sellerLabel(s: ProductState, remaining: number): string {
  if (s === 'in_stock' || s === 'low') return `${remaining} ta qoldi`
  return STATE_LABEL[s]
}
