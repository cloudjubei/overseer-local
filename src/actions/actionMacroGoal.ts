import TelegramBot, { Message } from 'node-telegram-bot-api'
import { GoalsService } from 'src/generated/backend'

export default async function actionMacroGoal(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  rawText: string,
  msg: Message,
  firstGoal: boolean,
) {
  // if (firstGoal)
  // Great! Let's setup your first goal.

  // What’s your main goal for this week?
  // You can type it in or send it as an audio message.
  // - input
  // Processing - give us a few seconds please...

  const voice = msg.voice
  const audio = msg.audio
  if (voice || audio) {
    const fileId = voice?.file_id || audio?.file_id

    // const { blob, filename, mimeType } = await downloadTelegramAudioFile(bot, fileId)
    // const result = await GoalsService.goalsControllerAiSuggestionsFromAudio({
    //   formData: { file: blob },
    // })
  } else {
    const text: string = 'text input'
    const result = await GoalsService.goalsControllerAiSuggestions({ requestBody: { text } })
  }

  // bot.sendMessage( 'Every morning you will get a set of 3 new micro goals.')

  // at the end needs to call actionMicroGoalsGenerate

  return true
}
