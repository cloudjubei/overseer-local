import TelegramBot, { Message } from 'node-telegram-bot-api'
import { ProfilesService, UserProfileModel } from 'src/generated/backend'

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

  let update = await ProfilesService.profilesControllerUpdate({ requestBody: { name: 'the name' } })

  // Please tell us your date of birth (YYYY-MM-DD)
  // - input

  update = await ProfilesService.profilesControllerUpdate({ requestBody: { dob: 'YYYY-MM-DD' } })

  // Please select your gender:
  // Male | Female | Other

  update = await ProfilesService.profilesControllerUpdate({
    requestBody: { gender: UserProfileModel.gender.FEMALE },
  })

  // Please tell us your weight (e.g., 82 kg, 180 lb, 11st 4lb)
  // - input
  update = await ProfilesService.profilesControllerUpdate({ requestBody: { weight_raw: '' } })

  // Please tell us your height (e.g., 175 cm, 1.75 m, 5'11")
  // - input
  update = await ProfilesService.profilesControllerUpdate({ requestBody: { height_raw: '' } })

  // FLOW is complete -> move onto actionLifestyle

  return false
}
