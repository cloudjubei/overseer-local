import TelegramBot, { Message } from 'node-telegram-bot-api'

export default async function actionJournalNudge(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  rawText: string,
  msg: Message,
) {
  // Would you like to record a short voice note about how today went?
  // - input
  // Thank you, have a great rest of the evening!

  return true
}
