import { useEffect, useRef, useState } from 'react'

// Telegram Login Widget. Requires NEXT_PUBLIC_TELEGRAM_BOT (bot @username, no @) and the bot's
// domain set in BotFather (/setdomain). On success the widget calls our global callback, which
// posts the signed payload to /api/auth/telegram to open a session, then fires onSuccess().
export default function TelegramLogin({ onSuccess }: { onSuccess: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const bot = process.env.NEXT_PUBLIC_TELEGRAM_BOT

  useEffect(() => {
    if (!bot || !ref.current) return
    ;(window as any).onTelegramAuth = async (user: any) => {
      setError('')
      const res = await fetch('/api/auth/telegram', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user),
      })
      if (res.ok) onSuccess()
      else { const j = await res.json().catch(() => ({})); setError(j.error ?? 'Kirishda xatolik') }
    }
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', bot)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '20')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    ref.current.appendChild(script)
    return () => { (window as any).onTelegramAuth = undefined }
  }, [bot, onSuccess])

  if (!bot) return <p className="text-sm text-danger">Telegram login sozlanmagan (NEXT_PUBLIC_TELEGRAM_BOT).</p>
  return (
    <div>
      <div ref={ref} />
      {error && <p className="text-sm text-danger mt-2">{error}</p>}
    </div>
  )
}
