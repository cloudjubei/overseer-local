import TelegramBot, { Message } from 'node-telegram-bot-api'
import { ensureAccessTokenForUser, ensureBackendConfigured, getTelegramUserId } from '../lib/auth'
import { GoalsService } from '../generated/backend'
import { renderAiSuggestionResult } from './suggestionRenderer'
import { getSession, setSession } from 'src/lib/sessionStore'

export default async function textSuggestionAction(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  rawText: string,
) {
  const userId = String(from.id)
  const prev = getSession(userId)

  const cmdMatch = rawText.match(/^\/t(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  if (cmdMatch) {
    setSession({
      ...(prev || { userId }),
      conversationState: {
        lastAction: 't',
        flowId: '',
      },
      accessToken: prev?.accessToken || '',
      idToken: prev?.idToken,
      refreshToken: prev?.refreshToken,
      expiresAt: prev?.expiresAt,
    })

    const header =
      '<b>Get a personalised goal</b>\n' + '<i>Describe what goal you would like to achieve?</i>'

    await bot.sendMessage(chat.id, header, { parse_mode: 'HTML' })
    return true
  }

  // if (prev?.conversationState?.lastAction == 't') {
  //   // current text is to get a suggestion from ai
  //   await ensureBackendConfigured()
  //   ensureAccessTokenForUser(userId)
  //   const waiting = await bot.sendMessage(chat.id, 'Processing your text...')

  //   try {
  //     const result = await GoalsService.goalsControllerAiSuggestions({
  //       requestBody: { text: rawText, transcriptionConfidence: 1 },
  //     })

  //     await renderAiSuggestionResult(bot, chat.id, result)
  //   } catch (err: any) {
  //     const errMsg = err?.response?.data || err?.message || 'Failed to process your message.'
  //     await bot.sendMessage(
  //       chat.id,
  //       typeof errMsg === 'string' ? errMsg : 'Failed to your message.',
  //     )
  //   } finally {
  //     try {
  //       await bot.deleteMessage(chat.id, waiting.message_id)
  //     } catch {}
  //   }
  //   return true
  // }
  return false
}
