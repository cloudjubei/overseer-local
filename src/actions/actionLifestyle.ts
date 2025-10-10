import TelegramBot, { Message } from 'node-telegram-bot-api'
import { ProfilesService, UserProfileLifestyleModel } from 'src/generated/backend'

export default async function actionLifestyle(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  rawText: string,
  _msg: Message,
) {
  //IF USER PROFILE doesn't have 1 lifestyle in userProfile.lifestyles
  const userProfile = await ProfilesService.profilesControllerMe()

  // How active are you currently?
  // 🛋️ Very low | 🚶‍♂️ Light | 🏃 Moderate | 💪 High | 🔥 Very high
  // (numeric value 1–5 stored behind the scenes)

  // How’s your energy and wellbeing today?
  // 😴 Very low | 😐 Low | 🙂 Okay | 😊 Good | 🤩 Great
  // (same structure as above)

  const newLifestyle: UserProfileLifestyleModel = { activeLevel: 0, energyLevel: 0 }
  const update = await ProfilesService.profilesControllerAddLifestyle({ requestBody: newLifestyle })

  // FLOW is complete - proceed to actionMacroGoal

  return false
}
