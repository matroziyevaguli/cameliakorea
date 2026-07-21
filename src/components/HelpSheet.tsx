import { X, Send, Phone, PlayCircle } from 'lucide-react'
import { S } from '@/consts/strings'
import { SELLER_CONFIG } from '@/consts/sellerConfig'

// A bottom sheet giving the seller a calm way to reach the admin. Contacts are
// config-driven (src/consts/sellerConfig.ts), never hardcoded here.
export default function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-1">
          <p className="font-display font-bold text-ink text-lg">{S.helpTitle}</p>
          <button aria-label="Yopish" onClick={onClose} className="text-muted hover:text-ink transition"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-muted mb-5">{S.helpSubtitle}</p>

        <div className="space-y-3">
          <a href={SELLER_CONFIG.adminTelegramUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-4 bg-cream rounded-2xl p-4 active:scale-[0.98] transition">
            <span className="w-11 h-11 rounded-full bg-sky/15 grid place-items-center flex-shrink-0"><Send className="w-5 h-5 text-sky" /></span>
            <div>
              <p className="font-semibold text-ink text-sm">{S.helpTelegram}</p>
              <p className="text-xs text-muted">{SELLER_CONFIG.adminTelegramHandle}</p>
            </div>
          </a>

          <a href={`tel:${SELLER_CONFIG.adminPhone}`}
            className="flex items-center gap-4 bg-cream rounded-2xl p-4 active:scale-[0.98] transition">
            <span className="w-11 h-11 rounded-full bg-mint/20 grid place-items-center flex-shrink-0"><Phone className="w-5 h-5 text-success" /></span>
            <div>
              <p className="font-semibold text-ink text-sm">{S.helpCall}</p>
              <p className="text-xs text-muted">{SELLER_CONFIG.adminPhoneDisplay}</p>
            </div>
          </a>

          {SELLER_CONFIG.helpVideoUrl && (
            <a href={SELLER_CONFIG.helpVideoUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-4 bg-cream rounded-2xl p-4 active:scale-[0.98] transition">
              <span className="w-11 h-11 rounded-full bg-rose/10 grid place-items-center flex-shrink-0"><PlayCircle className="w-5 h-5 text-rose" /></span>
              <div>
                <p className="font-semibold text-ink text-sm">{S.helpVideo}</p>
                <p className="text-xs text-muted">{S.helpVideoSub}</p>
              </div>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
