import TelegramBot, { Message } from 'node-telegram-bot-api'
import { ensureAccessTokenForUser, ensureBackendConfigured } from '../lib/auth'
import { JournalCreateTextModel, JournalsService } from '../generated/backend'
import { clearConversationSession, getSession, setSession } from 'src/lib/sessionStore'
import { downloadTelegramAudioFile } from 'src/lib/files'

export async function actionJournal(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  rawText: string,
) {
  const userId = String(from.id)
  const prev = getSession(userId)

  const cmdMatch = rawText.match(/^\/journal(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  if (cmdMatch) {
    setSession({
      ...(prev || { userId }),
      conversationState: {
        lastAction: 'journal',
        flowId: '',
      },
      accessToken: prev?.accessToken || '',
      idToken: prev?.idToken,
      refreshToken: prev?.refreshToken,
      expiresAt: prev?.expiresAt,
    })

    const header =
      '<b>Use this Journal for any thoughts</b>\n' +
      '<i>Describe how you feel and anything else you want to get off your chest</i>'

    await bot.sendMessage(chat.id, header, { parse_mode: 'HTML' })
    return true
  }
  console.log('actionJournal prev: ', prev)

  if (prev?.conversationState?.lastAction == 'journal') {
    const journalText = rawText.trim()
    if (journalText.length <= 0) {
      //TODO: handle the case when journal is too short
      return false
    }
    await ensureBackendConfigured()
    ensureAccessTokenForUser(userId)

    const waiting = await bot.sendMessage(chat.id, '📝 Processing your journal entry...')

    const body: JournalCreateTextModel = {
      text: journalText,
      label: 'telegram',
    }
    await JournalsService.journalsControllerCreateText({ requestBody: body })

    clearConversationSession(userId, prev)

    try {
      await bot.deleteMessage(chat.id, waiting.message_id)
    } catch {}

    await bot.sendMessage(chat.id, '📝 Journal entry recorded ✅')

    return true
  }
  return false
}

export default async function actionJournalAudio(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  rawText: string,
  msg: Message,
) {
  const userId = String(from.id)
  const prev = getSession(userId)

  // Case 1: Command /s -> prompt user to record a voice memo
  const cmdMatch = rawText.match(/^\/audio(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  console.log('LELELE actionJournalAudio cmdMatch: ', cmdMatch)

  if (cmdMatch) {
    setSession({
      ...(prev || { userId }),
      conversationState: {
        lastAction: 'audio',
        flowId: '',
      },
      accessToken: prev?.accessToken || '',
      idToken: prev?.idToken,
      refreshToken: prev?.refreshToken,
      expiresAt: prev?.expiresAt,
    })

    const header =
      '<b>Use this Journal for any thoughts</b>\n' +
      '<i>Tap and hold the microphone to record a short voice message describing how you feel.</i>'

    await bot.sendMessage(chat.id, header, { parse_mode: 'HTML' })
    return true
  }

  // Case 2: If this message contains a voice note or audio file, process it
  // Accept Telegram voice notes (msg.voice) and general audio (msg.audio)
  const voice = msg.voice
  const audio = msg.audio
  if (prev?.conversationState?.lastAction != 'audio' || (!voice && !audio)) {
    return false
  }
  console.log('LELELE actionJournalAudio voice: ', voice)

  await ensureBackendConfigured()
  ensureAccessTokenForUser(userId)

  const waiting = await bot.sendMessage(chat.id, '🎙️📝 Processing your audio journal entry...')

  try {
    const fileId = voice?.file_id || audio?.file_id
    if (!fileId) throw new Error('No file id found on message')

    const { blob, filename, mimeType } = await downloadTelegramAudioFile(bot, fileId)

    await JournalsService.journalsControllerCreateAudio({
      formData: { file: blob },
    })

    clearConversationSession(userId, prev)
    try {
      await bot.deleteMessage(chat.id, waiting.message_id)
    } catch {}

    await bot.sendMessage(chat.id, '🎙️📝 Journal entry recorded ✅')
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
