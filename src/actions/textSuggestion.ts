import TelegramBot, { Message } from 'node-telegram-bot-api'
import { ensureAccessTokenForUser, ensureBackendConfigured, getTelegramUserId } from '../lib/auth'
import { GoalsService } from '../generated/backend'
import { renderAiSuggestionResult, renderAiSuggestionResultKeyboard } from './suggestionRenderer'
import { getSession, setSession } from 'src/lib/sessionStore'
import { chooseSuggestion } from './quickSuggestion'

export async function textSuggestionActionMacro(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  rawText: string,
  messageId: number,
  hasResponse: number,
) {
  const userId = String(from.id)
  const prev = getSession(userId)

  const cmdMatch = rawText.match(/^\/macro(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  console.log('cmdMatch for textSuggestionActionMacro: ', cmdMatch)
  if (cmdMatch) {
    setSession({
      ...(prev || { userId }),
      conversationState: {
        lastAction: 'macro',
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
  console.log('textSuggestionActionMacro prev: ', prev)

  if (prev?.conversationState?.lastAction == 'macro') {
    if (hasResponse >= 0) {
      const prevMessageId = prev.conversationState?.responsesMessageId ?? messageId
      await chooseSuggestion(bot, chat.id, userId, prevMessageId, hasResponse)
      return true
    }

    // current text is to get a suggestion from ai
    await ensureBackendConfigured()
    ensureAccessTokenForUser(userId)
    const waiting = await bot.sendMessage(chat.id, 'Processing your text...')

    try {
      const result = await GoalsService.goalsControllerAiSuggestions({
        requestBody: { text: rawText, transcriptionConfidence: 1, type: 'MACRO' },
      })

      const sent = await renderAiSuggestionResultKeyboard(bot, chat.id, result)
      setSession({
        ...(prev || { userId }),
        conversationState: {
          lastAction: 'macro',
          responses: [hasResponse],
          responsesMessageId: sent.message_id,
          flowId: '',
        },
        accessToken: prev?.accessToken || '',
        idToken: prev?.idToken,
        refreshToken: prev?.refreshToken,
        expiresAt: prev?.expiresAt,
      })
    } catch (err: any) {
      const errMsg = err?.response?.data || err?.message || 'Failed to process your message.'
      await bot.sendMessage(
        chat.id,
        typeof errMsg === 'string' ? errMsg : 'Failed to your message.',
      )
    } finally {
      try {
        await bot.deleteMessage(chat.id, waiting.message_id)
      } catch {}
    }
    return true
  }
  return false
}

export async function textSuggestionActionMicro(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  rawText: string,
) {
  const userId = String(from.id)
  const prev = getSession(userId)

  const cmdMatch = rawText.match(/^\/micro(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  console.log('cmdMatch for text: ', cmdMatch)
  if (cmdMatch) {
    setSession({
      ...(prev || { userId }),
      conversationState: {
        lastAction: 'micro',
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

  if (prev?.conversationState?.lastAction == 'micro') {
    // current text is to get a suggestion from ai
    await ensureBackendConfigured()
    ensureAccessTokenForUser(userId)
    const waiting = await bot.sendMessage(chat.id, 'Processing your text...')

    try {
      const result = await GoalsService.goalsControllerAiSuggestions({
        requestBody: { text: rawText, transcriptionConfidence: 1, type: 'MICRO' },
      })

      await renderAiSuggestionResult(bot, chat.id, result)
    } catch (err: any) {
      const errMsg = err?.response?.data || err?.message || 'Failed to process your message.'
      await bot.sendMessage(
        chat.id,
        typeof errMsg === 'string' ? errMsg : 'Failed to your message.',
      )
    } finally {
      try {
        await bot.deleteMessage(chat.id, waiting.message_id)
      } catch {}
    }
    return true
  }
  return false
}
