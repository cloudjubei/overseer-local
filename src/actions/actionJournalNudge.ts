import TelegramBot, { Message } from 'node-telegram-bot-api'

export default async function actionJournalNudge(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  rawText: string,
  msg: Message,
) {
  // Would you like to leave a short voice note or type a few words about how the day felt?
  // - input as text ->
  // await JournalsService.journalsControllerCreateText()
  // - input as audio ->
  // await JournalsService.journalsControllerCreateAudio()
  // -- before processing show a processing message similar to how `actionJournal` does it
  // -- after, remove that and send below:
  // Thank you, have a great rest of the evening!

  return true
}
