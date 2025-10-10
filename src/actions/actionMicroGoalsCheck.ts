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

  // Which of the 3 micro goals were completed?
  // ✅ Goal 1 ❎
  // ✅ Goal 2 ❎
  // ✅ Goal 3 ❎

  //call actionJournalNudge

  return true
}
