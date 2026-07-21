import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@/lib/supabase/browser'
import { formatUZS, formatDate } from '@/lib/format'
import { Bell, X, ClipboardList, RotateCcw, Wallet, Check, XCircle } from 'lucide-react'

// 🔔 Everything waiting on the seller, in one place (redesign.md §4.6).
// Replaces the buried /seller/requests page as the *primary* way she learns an
// outcome — that page stays as the full history, behind ⚙.
//
// Read-state is per-device in localStorage (a "last seen" timestamp): no schema
// change, and unread-ness is genuinely a per-device notion anyway.

const SEEN_KEY = 'camelia_notifs_seen_v1'

type Notif = {
  id: string
  at: string                      // ISO timestamp — drives ordering + unread
  icon: 'request' | 'price' | 'transfer' | 'payment'
  tone: 'good' | 'bad' | 'wait'
  text: string
  sub?: string
  href?: string
}

const ICONS = { request: ClipboardList, price: ClipboardList, transfer: RotateCcw, payment: Wallet }
const TONE = {
  good: { ring: 'bg-green-100', fg: 'text-success' },
  bad:  { ring: 'bg-red-100',   fg: 'text-danger' },
  wait: { ring: 'bg-orange-100',fg: 'text-warning' },
}

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [seenAt, setSeenAt] = useState<string>('')

  useEffect(() => { setSeenAt(localStorage.getItem(SEEN_KEY) ?? '') }, [])

  async function load() {
    const supabase = createClient()
    const [reqs, prices, transfers, payments] = await Promise.all([
      supabase.from('v_my_requests').select('*'),
      supabase.from('v_my_price_requests').select('*'),
      supabase.from('v_my_transfers').select('id, qty, status, from_name, product_name, is_outgoing, created_at'),
      supabase.from('payments').select('id, amount, note, paid_at'),
    ])

    const out: Notif[] = []

    // Allocation / new-product requests the admin has answered
    for (const r of (reqs.data ?? []) as any[]) {
      if (r.status === 'pending') continue
      const ok = r.status === 'approved'
      out.push({
        id: `req-${r.id}`,
        at: r.resolved_at ?? r.created_at,
        icon: 'request', tone: ok ? 'good' : 'bad',
        text: ok ? `So'rovingiz tasdiqlandi: ${r.product_name}` : `So'rovingiz rad etildi: ${r.product_name}`,
        sub: r.admin_note ? `Admin: ${r.admin_note}` : `${r.requested_qty} ta`,
        href: '/seller/requests',
      })
    }

    // Price-change requests the admin has answered
    for (const r of (prices.data ?? []) as any[]) {
      if (r.status === 'pending') continue
      const ok = r.status === 'approved'
      out.push({
        id: `price-${r.id}`,
        at: r.resolved_at ?? r.created_at,
        icon: 'price', tone: ok ? 'good' : 'bad',
        text: ok ? `Narx so'rovi tasdiqlandi: ${r.product_name}` : `Narx so'rovi rad etildi: ${r.product_name}`,
        sub: r.admin_note ? `Admin: ${r.admin_note}` : `${formatUZS(r.requested_price)}`,
        href: '/seller/requests',
      })
    }

    // Returns waiting for HER confirmation — the only actionable item
    for (const t of (transfers.data ?? []) as any[]) {
      if (t.is_outgoing || t.status !== 'pending') continue
      out.push({
        id: `tx-${t.id}`,
        at: t.created_at,
        icon: 'transfer', tone: 'wait',
        text: `${t.from_name} sizga ${t.qty} ta qaytarmoqchi`,
        sub: `${t.product_name} — tasdiqlang`,
        href: '/seller/transfers',
      })
    }

    // Payments the admin recorded → her debt dropped
    for (const p of (payments.data ?? []) as any[]) {
      out.push({
        id: `pay-${p.id}`,
        at: p.paid_at,
        icon: 'payment', tone: 'good',
        text: `To'lov qabul qilindi: ${formatUZS(p.amount)}`,
        sub: p.note ?? undefined,
        href: '/seller/balance',
      })
    }

    out.sort((a, b) => (a.at < b.at ? 1 : -1))
    setItems(out.slice(0, 40))
  }

  useEffect(() => { load() }, [router.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const unread = items.filter(i => !seenAt || i.at > seenAt).length

  function markAllRead() {
    const now = new Date().toISOString()
    localStorage.setItem(SEEN_KEY, now)
    setSeenAt(now)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Bildirishnomalar"
        className="relative text-white/70 hover:text-white p-2 transition">
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-danger text-white text-[9px] font-bold">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-surface rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-bold text-ink text-lg">Bildirishnomalar</p>
              <button aria-label="Yopish" onClick={() => setOpen(false)} className="text-muted hover:text-ink transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center text-muted py-10">
                <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Hozircha yangilik yo'q</p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  {items.map(n => {
                    const Icon = ICONS[n.icon]
                    const tone = TONE[n.tone]
                    const isUnread = !seenAt || n.at > seenAt
                    const body = (
                      <div className={`flex items-start gap-3 px-3 py-3 rounded-xl transition ${isUnread ? 'bg-rose/5' : ''}`}>
                        <span className={`w-9 h-9 rounded-full ${tone.ring} grid place-items-center flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${tone.fg}`} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink leading-snug">{n.text}</p>
                          {n.sub && <p className="text-xs text-muted mt-0.5">{n.sub}</p>}
                          <p className="text-[11px] text-muted/60 mt-0.5">{formatDate(n.at)}</p>
                        </div>
                        {isUnread && <span className="w-2 h-2 rounded-full bg-rose flex-shrink-0 mt-2" />}
                      </div>
                    )
                    return n.href ? (
                      <button key={n.id} className="w-full text-left"
                        onClick={() => { markAllRead(); setOpen(false); router.push(n.href!) }}>
                        {body}
                      </button>
                    ) : <div key={n.id}>{body}</div>
                  })}
                </div>

                {unread > 0 && (
                  <button onClick={markAllRead}
                    className="w-full mt-4 flex items-center justify-center gap-2 bg-cream text-ink text-sm font-semibold py-3 rounded-full active:scale-95 transition">
                    <Check className="w-4 h-4" /> Hammasini o'qilgan deb belgilash
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
