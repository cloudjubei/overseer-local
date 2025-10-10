import TelegramBot, { Message } from 'node-telegram-bot-api'
import { GoalsService } from 'src/generated/backend'

export default async function actionMicroGoalsCheck(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  rawText: string,
  msg: Message,
) {
  // const result = await GoalsService.goalsControllerGet()

  // #EVENING CHECK IN#
  // How did your day go? Which micro goals did you complete?
  // ✅ Goal 1 ❎
  // ✅ Goal 2 ❎
  // ✅ Goal 3 ❎

  // -- after user has updated all 3
  // bot.sendMessage( 'Great! Thanks for these responses.')

  // FLOW is complete - proceed to actionJournalNudge

  return true
}
