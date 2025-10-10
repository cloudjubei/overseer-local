import TelegramBot, { Message } from 'node-telegram-bot-api'
import { GoalsService } from 'src/generated/backend'

export default async function actionMicroGoalsGenerate(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  rawText: string,
  msg: Message,
) {
  const result = await GoalsService.goalsControllerGenerateMicroGoals()

  // Here are your 3 micro goals for today.
  // - goal1
  // - goal2
  // - goal3

  // We will check in with you in the evening to see how things went.
  // At any time please feel free to use the journal function `/j` to send any thoughts you have about the goals or anything at all about your wellbeing.

  // #EVENING CHECK IN#
  // Which of the 3 micro goals were completed?
  // ✅ Goal 1 ❎
  // ✅ Goal 2 ❎
  // ✅ Goal 3 ❎

  // Would you like to record a short voice note about how today went?
  // - input
  // Thank you, have a great rest of the evening!

  return true
}
