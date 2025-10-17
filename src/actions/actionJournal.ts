import TelegramBot, { Message } from 'node-telegram-bot-api'
import { ensureAccessTokenForUser, ensureBackendConfigured } from '../lib/auth'
import { JournalCreateTextModel, JournalsService } from '../generated/backend'
import { clearConversationSession, getSession, setSession } from 'src/lib/sessionStore'
import { downloadTelegramAudioFile } from 'src/lib/files'
import { sleep } from 'src/lib/time'

export async function processTextJournal(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  rawText: string,
) {
  const userId = String(from.id)
  const journalText = rawText.trim()
  if (journalText.length <= 0) {
    //TODO: handle the case when journal is too short
    return
  }
  await ensureBackendConfigured()
  ensureAccessTokenForUser(userId)

  const waiting = await bot.sendMessage(chat.id, '📝 Processing your journal entry...')

  const body: JournalCreateTextModel = {
    text: journalText,
    label: 'telegram',
  }
  const created = await JournalsService.journalsControllerCreateText({ requestBody: body })

  const session = getSession(userId)
  clearConversationSession(userId, session)

  try {
    await bot.deleteMessage(chat.id, waiting.message_id)
  } catch {}

  await bot.sendMessage(chat.id, created.acknowledgmentText.trim())
}

export async function processAudioJournal(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  msg: Message,
) {
  const userId = String(from.id)
  const voice = msg.voice
  const audio = msg.audio
  if (!voice && !audio) {
    return
  }

  await ensureBackendConfigured()
  ensureAccessTokenForUser(userId)

  const waiting = await bot.sendMessage(chat.id, '🎙️📝 Processing your audio journal entry...')

  try {
    const fileId = voice?.file_id || audio?.file_id
    if (!fileId) throw new Error('No file id found on message')

    const { blob } = await downloadTelegramAudioFile(bot, fileId)

    const created = await JournalsService.journalsControllerCreateAudio({
      formData: { file: blob },
    })

    const userSentence =
      created.transcription?.confirmationText?.trim() ||
      created.transcription?.text?.trim() ||
      created.text

    const confirmText = ` <b>Here’s what I captured from your reflection — would you like to keep it or re-record?</b>\n<i>${userSentence}</i>`

    const keyboard: TelegramBot.InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: '✅ Submit', callback_data: `journal:audio:submit:${created.id}` },
          { text: '🔁 Re-record', callback_data: `journal:audio:rerecord:${created.id}` },
        ],
      ],
    }

    // Send confirmation with inline buttons
    const sent = await bot.sendMessage(chat.id, confirmText, {
      reply_markup: keyboard,
      parse_mode: 'HTML',
    })

    // Store pending journal confirmation state in session, including acknowledgment text for final reply
    const prev = getSession(userId)
    setSession({
      ...(prev || { userId }),
      accessToken: prev?.accessToken || '',
      idToken: prev?.idToken,
      refreshToken: prev?.refreshToken,
      expiresAt: prev?.expiresAt,
      conversationState: {
        lastAction: 'journal_audio_confirm',
        flowId: '',
        context: {
          pendingJournal: {
            id: created.id,
            messageId: sent.message_id,
            acknowledgmentText: created.acknowledgmentText.trim(),
          },
        },
        lastUpdatedAt: Math.floor(Date.now() / 1000),
      },
    })

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
}

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

    const header = '<b>Take a minute to reflect - how’s today been so far?</b>\n' //+ '<i>You can talk or type</i>'

    await bot.sendMessage(chat.id, header, { parse_mode: 'HTML' })
    return true
  }

  if (prev?.conversationState?.lastAction === 'journal') {
    await processTextJournal(bot, chat, from, rawText)
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

  // Case 1: Command /voice -> prompt user to record a voice memo
  const cmdMatch = rawText.match(/^\/voice(?:@\w+)?(?:\s+([\s\S]*))?$/i)

  if (cmdMatch) {
    setSession({
      ...(prev || { userId }),
      conversationState: {
        lastAction: 'voice',
        flowId: '',
      },
      accessToken: prev?.accessToken || '',
      idToken: prev?.idToken,
      refreshToken: prev?.refreshToken,
      expiresAt: prev?.expiresAt,
    })

    const header = '<b>Take a minute to reflect - how’s today been so far?</b>\n' // + '<i>You can talk or type</i>'

    await bot.sendMessage(chat.id, header, { parse_mode: 'HTML' })
    return true
  }

  // Case 2: If this message contains a voice note or audio file, process it
  if (prev?.conversationState?.lastAction === 'voice' && (msg.voice || msg.audio)) {
    await processAudioJournal(bot, chat, from, msg)
    return true
  }

  return false
}
