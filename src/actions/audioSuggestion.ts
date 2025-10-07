import TelegramBot, { Message } from 'node-telegram-bot-api'
import { ensureAccessTokenForUser, ensureBackendConfigured, getTelegramUserId } from '../lib/auth'
import { renderAiSuggestionResult } from './suggestionRenderer'
import { GoalsService } from 'src/generated/backend/services/GoalsService'
import { downloadTelegramAudioFile } from 'src/lib/files'
import { getSession, setSession } from 'src/lib/sessionStore'

export default async function audioSuggestionAction(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  rawText: string,
  msg: Message,
) {
  const userId = String(from.id)
  const prev = getSession(userId)

  // Case 1: Command /s -> prompt user to record a voice memo
  const cmdMatch = rawText.match(/^\/s(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  console.log('LELELE audioSuggestionAction cmdMatch: ', cmdMatch)
  if (cmdMatch) {
    setSession({
      ...(prev || { userId }),
      conversationState: {
        lastAction: 's',
        flowId: '',
      },
      accessToken: prev?.accessToken || '',
      idToken: prev?.idToken,
      refreshToken: prev?.refreshToken,
      expiresAt: prev?.expiresAt,
    })

    const header =
      '<b>Voice memo for goal suggestions</b>\n' +
      "<i>Tap and hold the microphone to record a short voice message describing what you want to achieve. I'll transcribe it and suggest goals.</i>"

    await bot.sendMessage(chat.id, header, { parse_mode: 'HTML' })
    return true
  }

  // Case 2: If this message contains a voice note or audio file, process it
  // Accept Telegram voice notes (msg.voice) and general audio (msg.audio)
  const voice = msg.voice
  const audio = msg.audio
  if (prev?.conversationState?.lastAction != 's' || (!voice && !audio)) {
    return false
  }
  console.log('LELELE audioSuggestionAction voice: ', voice)

  await ensureBackendConfigured()
  ensureAccessTokenForUser(userId)

  const waiting = await bot.sendMessage(chat.id, '🎙️ Processing your voice entry...')

  try {
    const fileId = voice?.file_id || audio?.file_id
    if (!fileId) throw new Error('No file id found on message')

    const { blob, filename, mimeType } = await downloadTelegramAudioFile(bot, fileId)

    const result = await GoalsService.goalsControllerAiSuggestionsFromAudio({
      formData: { file: blob },
    })

    // Render nicely following the mock style
    await renderAiSuggestionResult(bot, chat.id, result)

    // Optionally remove the waiting message to reduce clutter
    try {
      await bot.deleteMessage(chat.id, waiting.message_id)
    } catch {}
  } catch (err: any) {
    console.log('ERROR FROM PROCESSING AUDIO: ', err)
    // Clean up waiting message
    try {
      await bot.deleteMessage(chat.id, waiting.message_id)
    } catch {}

    const errMsg = err?.response?.data || err?.message || 'Failed to process audio.'
    await bot.sendMessage(chat.id, typeof errMsg === 'string' ? errMsg : 'Failed to process audio.')
  }

  return true
}
