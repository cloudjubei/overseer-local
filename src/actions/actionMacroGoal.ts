import TelegramBot, { Message } from 'node-telegram-bot-api'
import {
  CheckInCreateModel,
  CheckInModel,
  CheckInsService,
  GoalModel,
  GoalsService,
  GoalSuggestedModel,
} from 'src/generated/backend'
import { downloadTelegramAudioFile } from 'src/lib/files'

export default async function actionMacroGoal(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  rawText: string,
  msg: Message,
  firstGoal: boolean = false,
) {
  if (firstGoal) {
    //SENT ONLY THE VERY FIRST TIME the user gets to generate a macro goal
    // bot.sendMessage( 'Got it — now let’s set your direction for the week.')
  }

  // What’s something that really matters to you right now — maybe around your health, focus, or wellbeing?
  // You can type it in or send a voice message.

  // Here are a few ideas if you need inspiration:

  const suggestions: GoalSuggestedModel[] =
    await GoalsService.goalsControllerGenerateMacroGoalSuggestions()

  // !!! EXAMPLE !!!
  // 💪 Get back into a workout routine
  // 😌 Reduce stress and feel calmer
  // 🔋 Improve sleep and energy

  // -- after user input:
  // Processing - give us a few seconds please...

  //first always
  await CheckInsService.checkInsControllerClearCheckIns()

  const voice = msg.voice
  const audio = msg.audio
  if (voice || audio) {
    const fileId = voice?.file_id || audio?.file_id
    if (!fileId) {
      return
    }

    const { blob, filename, mimeType } = await downloadTelegramAudioFile(bot, fileId)
    const result: GoalModel = await GoalsService.goalsControllerCreateMacroGoalFromAudio({
      formData: { file: blob },
    })
  } else {
    const text: string = 'text input'
    const result: GoalModel = await GoalsService.goalsControllerCreateMacroGoalFromText({
      requestBody: { text },
    })
  }

  const now = new Date()
  const morningCheckIn = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0)
  morningCheckIn.setDate(morningCheckIn.getDate() + 1)
  const eveningCheckIn = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0)
  if (now.getHours() > 12) {
    eveningCheckIn.setDate(eveningCheckIn.getDate() + 1)
  }

  await CheckInsService.checkInsControllerAddCheckIn({
    requestBody: {
      start: morningCheckIn.toISOString(),
      frequency: CheckInModel.frequency.DAILY,
      metadata: {
        message: `<b>Morning Reminder!</b>`,
        chatId,
      },
    },
  })

  await CheckInsService.checkInsControllerAddCheckIn({
    requestBody: {
      start: eveningCheckIn.toISOString(),
      frequency: CheckInModel.frequency.DAILY,
      metadata: {
        message: `<b>Evening Check in!</b>`,
        chatId,
      },
    },
  })

  // bot.sendMessage( 'Every morning you will get a set of 3 new micro goals.')

  // FLOW is complete - proceed to actionMicroGoalsGenerate

  return true
}
