// Offline-safe sale queue. When a seller records a sale with no signal, we keep it in
// localStorage and re-send it when the connection returns — so a tap is never lost.
import type { SupabaseClient } from '@supabase/supabase-js'

export type PendingSale = {
  seller_id: string
  product_id: string
  qty: number
  unit_price: number
  note: string | null
  client_ts: number   // unique id for dedupe
}

const KEY = 'camelia_pending_sales'

export function getPending(): PendingSale[] {
  if (typeof localStorage === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function addPending(sale: PendingSale) {
  const list = getPending()
  list.push(sale)
  localStorage.setItem(KEY, JSON.stringify(list))
}

function removePending(clientTs: number) {
  localStorage.setItem(KEY, JSON.stringify(getPending().filter(s => s.client_ts !== clientTs)))
}

// Re-insert every queued sale; drop each only after a confirmed insert (no double-sends).
// Returns how many were sent this run.
export async function flushPending(supabase: SupabaseClient): Promise<number> {
  const list = getPending()
  if (!list.length) return 0
  let sent = 0
  for (const s of list) {
    const { error } = await supabase.from('sales').insert({
      seller_id: s.seller_id, product_id: s.product_id, qty: s.qty, unit_price: s.unit_price, note: s.note,
    })
    if (!error) { removePending(s.client_ts); sent++ }
    // On error (still offline, or e.g. oversell) leave it queued for the next attempt.
  }
  return sent
}
