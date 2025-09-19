import TelegramBot, { Message } from 'node-telegram-bot-api'

export default async function audioSuggestionAction(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  rawText: string,
  _msg: Message,
) {
  const match = rawText.match(/^\/s(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  if (!match) {
    return false
  }

  const header = '<b>Voice memo for goal suggestions</b>\n' +
    '<i>Tap and hold the microphone to record a short voice message describing what you want to achieve. I\'ll transcribe it and suggest goals.</i>'

  await bot.sendMessage(chat.id, header, { parse_mode: 'HTML' })
  return true
}
