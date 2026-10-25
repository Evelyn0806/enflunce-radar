// Operator alerts to the same Telegram chat the Radar bot serves (TELEGRAM_CHAT_ID).
// Returns false when the bot isn't configured or Telegram rejects the message.
export async function sendTelegramAlert(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
    })
    return res.ok
  } catch {
    return false
  }
}
