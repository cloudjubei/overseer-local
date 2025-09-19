import TelegramBot, { Message } from 'node-telegram-bot-api'
import { GoalsService } from 'src/generated/backend'
import { ensureAccessTokenForUser, ensureBackendConfigured } from 'src/lib/auth'
import { renderAiSuggestionResult } from './suggestionRenderer'

export default async function quickSuggestionAction(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  rawText: string,
  msg: Message,
) {
  const match = rawText.match(/^\/q(?:@\w+)?(?:\s+([\s\S]*))?$/i)
  if (!match) {
    return false
  }

  const input = (match[1] || '').trim()
  if (!input) {
    await bot.sendMessage(chat.id, 'Please say what do you need suggestions for?')
    return
  }

  const userId = String(from.id)

  try {
    await ensureBackendConfigured()
    ensureAccessTokenForUser(userId)

    const response = await GoalsService.goalsControllerAiSuggestions({
      requestBody: { text: input, transcriptionConfidence: 1 },
    })

    // Use the suggestion renderer to format and send the response nicely
    await renderAiSuggestionResult(bot, chat.id, response)
  } catch (err: any) {
    const errMsg = err?.response?.data || err?.message || 'LLM test failed.'
    await bot.sendMessage(chat.id, typeof errMsg === 'string' ? errMsg : 'LLM test failed.')
  }
  return true
}
