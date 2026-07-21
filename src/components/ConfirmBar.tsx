// The ONE confirmation pattern (redesign.md G1). Renders in place of the row's
// actions — never a native window.confirm(), which blocks the page on Android and
// breaks the visual language.
//
// Usage: keep a `confirmingId` in the parent, render <ConfirmBar> instead of the
// normal action row when it matches.
export default function ConfirmBar({
  question,
  confirmLabel = 'Ha',
  cancelLabel = 'Bekor qilish',
  busy = false,
  tone = 'danger',
  compact = false,
  onConfirm,
  onCancel,
}: {
  question: string
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  tone?: 'danger' | 'primary'
  /** Row layout for tight spots (table cells) — same words, same order, no divider. */
  compact?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const confirmCls = tone === 'danger'
    ? 'bg-danger text-white'
    : 'bg-gradient-to-br from-rose to-peach text-white shadow-rose'

  if (compact) return (
    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
      <span className="text-xs text-ink">{question}</span>
      <button onClick={onCancel} disabled={busy}
        className="text-xs font-semibold text-muted px-2 py-1 disabled:opacity-50">{cancelLabel}</button>
      <button onClick={onConfirm} disabled={busy}
        className={`text-xs font-semibold ${confirmCls} px-3 py-1.5 rounded-full active:scale-95 transition disabled:opacity-50`}>
        {busy ? '…' : confirmLabel}
      </button>
    </div>
  )

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-sm text-ink mb-2 leading-snug">{question}</p>
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={busy}
          className="flex-1 bg-cream text-ink text-sm font-semibold py-2.5 rounded-full active:scale-95 transition disabled:opacity-50">
          {cancelLabel}
        </button>
        <button onClick={onConfirm} disabled={busy}
          className={`flex-1 ${confirmCls} text-sm font-semibold py-2.5 rounded-full active:scale-95 transition disabled:opacity-50`}>
          {busy ? '…' : confirmLabel}
        </button>
      </div>
    </div>
  )
}
