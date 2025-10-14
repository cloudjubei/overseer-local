import TelegramBot, { Message } from 'node-telegram-bot-api'
import { GoalsService } from 'src/generated/backend'

function escapeHtml(input: string): string {
  return (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default async function actionMicroGoalsGenerate(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  _from: TelegramBot.User,
  _rawText: string,
  _msg: Message,
) {
  const chatId = chat.id

  try {
    const goals = await GoalsService.goalsControllerGenerateMicroGoals()
    const list = (goals || []).slice(0, 3)

    // Build the formatted message with exactly three bullets (if fewer returned, show what we have)
    const header = '<b>Here are your 3 micro goals for today.</b>'
    const bullets = list.map((g) => `• ${escapeHtml(g.text || '')}`).join('\n')

    const body = [header, '', bullets].join('\n')

    await bot.sendMessage(chatId, body, { parse_mode: 'HTML' })

    const followUp =
      'I’ll check in with you tonight at 8 PM — you can always journal or send a voice note before then.'

    await bot.sendMessage(chatId, followUp, { parse_mode: 'HTML' })
  } catch (err) {
    console.error(err)
    // Minimal user-facing error; keep idempotent and non-blocking
    await bot.sendMessage(
      chatId,
      "Sorry, I could not generate today's micro goals. Please try again later.",
    )
  }

  // FLOW is complete - user can use the app normally
  return true
}
