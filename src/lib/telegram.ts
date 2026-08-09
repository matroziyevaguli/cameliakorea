// Minimal owner notification via the existing bot. Fire-and-forget; never throws into the caller.
export async function notifyOwner(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chat = process.env.TELEGRAM_OWNER_CHAT_ID
  if (!token || !chat) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    })
  } catch { /* notifications are best-effort */ }
}
