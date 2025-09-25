import TelegramBot, { Message } from 'node-telegram-bot-api'
import { ensureAccessTokenForUser, ensureBackendConfigured, getTelegramUserId } from '../lib/auth'
import { renderAiSuggestionResult } from './suggestionRenderer'
import { GoalsService } from 'src/generated/backend/services/GoalsService'

// Helper to download a Telegram file as Buffer
async function downloadTelegramFile(
  bot: TelegramBot,
  fileId: string,
): Promise<{ blob: Blob; filename: string; mimeType?: string }> {
  // getFile gives us file_path, but getFileLink constructs a full URL including token
  const fileUrl = await bot.getFileLink(fileId as any)
  // Node 18+ provides global fetch
  const res = await fetch(fileUrl)
  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status} ${res.statusText}`)
  }

  // await res.
  const blob = await res.blob()

  // Try to derive filename from URL
  const urlObj = new URL(fileUrl)
  const pathname = urlObj.pathname
  const base = pathname.substring(pathname.lastIndexOf('/') + 1) || 'voice.oga'
  const contentType = res.headers.get('content-type') || undefined

  return { blob, filename: base, mimeType: contentType || 'audio/ogg' }
}

export default async function audioSuggestionAction(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  rawText: string,
  msg: Message,
) {
  // Case 1: Command /s -> prompt user to record a voice memo
  const cmdMatch = rawText.match(/^\/s(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  console.log('LELELE audioSuggestionAction cmdMatch: ', cmdMatch)
  if (cmdMatch) {
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
  console.log('LELELE audioSuggestionAction voice: ', voice)
  if (!voice && !audio) {
    return false
  }

  // Ensure backend auth configured
  await ensureBackendConfigured()
  const userId = getTelegramUserId(msg)
  if (!userId) {
    await bot.sendMessage(chat.id, 'Unable to determine your Telegram user id.')
    return true
  }
  ensureAccessTokenForUser(userId)

  // Acknowledge receipt
  const waiting = await bot.sendMessage(chat.id, '🎙️ Processing your voice memo...')

  try {
    const fileId = voice?.file_id || audio?.file_id
    if (!fileId) throw new Error('No file id found on message')

    const { blob, filename, mimeType } = await downloadTelegramFile(bot, fileId)

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
