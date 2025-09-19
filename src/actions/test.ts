import TelegramBot from 'node-telegram-bot-api'

export default async function testAction(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  rawText: string,
) {
  const testMatch = rawText.match(/^\/test(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  if (!testMatch) {
    return false
  }

  const payload = (testMatch[1] || '').trim()
  if (!payload) {
    await bot.sendMessage(chat.id, 'Usage: /test <text to echo with stars>')
  } else {
    await bot.sendMessage(chat.id, `⭐ ${payload} ⭐`)
  }
  return true
}
