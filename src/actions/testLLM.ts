import TelegramBot, { Message } from 'node-telegram-bot-api'
import { AiService } from 'src/generated/backend'
import { ensureAccessTokenForUser, ensureBackendConfigured, handleAuthMessage } from 'src/lib/auth'

export default async function testLLMAction(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  rawText: string,
  msg: Message,
) {
  const llmMatchEarly = rawText.match(/^\/test(l|L)(l|L)(m|M)(@\w+)?(?:\s+([\s\S]*))?$/i)
  if (!llmMatchEarly) {
    return false
  }

  const authHandledForLlm = await handleAuthMessage(bot, msg)
  if (authHandledForLlm) return true

  const userId = String(from.id)
  const rawPayload = (llmMatchEarly[2] || '').trim()
  if (!rawPayload) {
    await bot.sendMessage(
      chat.id,
      'Usage: /test-llm [openai|gemini|anthropic]: <your prompt>\nExample: /test-llm openai: Hello world',
    )
    return
  }

  // Parse optional model prefix like "openai:", "gemini:", "anthropic:" or flag "--model <name>"
  let model: 'openai' | 'gemini' | 'anthropic' = 'anthropic'
  let input = rawPayload

  const modelPrefixMatch = rawPayload.match(/^(openai|gemini|anthropic)\s*:([\s\S]*)$/i)
  if (modelPrefixMatch) {
    model = modelPrefixMatch[1].toLowerCase() as typeof model
    input = (modelPrefixMatch[2] || '').trim()
  } else {
    const flagMatch = rawPayload.match(/^--model\s+(openai|gemini|anthropic)\s+([\s\S]*)$/i)
    if (flagMatch) {
      model = flagMatch[1].toLowerCase() as typeof model
      input = (flagMatch[2] || '').trim()
    }
  }

  if (!input) {
    await bot.sendMessage(chat.id, 'Please provide text to send to the LLM.')
    return
  }

  try {
    await ensureBackendConfigured()
    ensureAccessTokenForUser(userId)

    const response = await AiService.aiControllerTest({
      model,
      // Send raw text as request body; backend returns raw text
      requestBody: { text: input },
    })

    await bot.sendMessage(chat.id, response || '(empty response)')
  } catch (err: any) {
    const errMsg = err?.response?.data || err?.message || 'LLM test failed.'
    await bot.sendMessage(chat.id, typeof errMsg === 'string' ? errMsg : 'LLM test failed.')
  }
  return true
}
