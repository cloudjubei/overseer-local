import TelegramBot, { Message } from 'node-telegram-bot-api'
import { ProfilesService } from 'src/generated/backend'

export default async function actionProfile(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  rawText: string,
  _msg: Message,
) {
  //IF USER PROFILE IS MISSING ANY OF THE PIECES inside
  const userProfile = await ProfilesService.profilesControllerMe()
  // if (!userProfile.name)
  // userProfile.dob
  // userProfile.gender
  // userProfile.weight
  // userProfile.height

  // Just a few quick questions to personalise your experience.
  // Please tell us your name
  // - input

  // Please tell us your date of birth (YYYY-MM-DD)
  // - input

  // Please select your gender:
  // Male | Female | Other

  // Please tell us your weight (e.g., 82 kg, 180 lb, 11st 4lb)
  // - input

  // Please tell us your height (e.g., 175 cm, 1.75 m, 5'11")
  // - input

  // FLOW is complete

  return false
}
