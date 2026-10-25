// Operator alerts to the same Telegram chat the Radar bot serves (TELEGRAM_CHAT_ID).
// `reason` explains a failed send (missing env var or Telegram's error description) without exposing secrets.
export async function sendTelegramAlert(text: string): Promise<{ sent: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) {
    const missing = [!token && 'TELEGRAM_BOT_TOKEN', !chatId && 'TELEGRAM_CHAT_ID'].filter(Boolean).join(', ')
    return { sent: false, reason: `not configured: ${missing}` }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
    })
    if (res.ok) return { sent: true }
    const json = await res.json().catch(() => null)
    return { sent: false, reason: `telegram ${res.status}: ${json?.description ?? 'unknown error'}` }
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : String(e) }
  }
}
