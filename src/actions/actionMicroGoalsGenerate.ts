import TelegramBot, { Message } from 'node-telegram-bot-api'
import { GoalsService } from 'src/generated/backend'
import { clearConversationSession, getSession, setSession } from 'src/lib/sessionStore'

function escapeHtml(input: string): string {
  return (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\"/g, '&quot;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function todayStamp(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function buildMorningEnergyKeyboard(): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '1 😴 Very low', callback_data: 'morning:energy:1' },
        { text: '2 😐 Low', callback_data: 'morning:energy:2' },
      ],
      [
        { text: '3 🙂 Okay', callback_data: 'morning:energy:3' },
        { text: '4 😊 Good', callback_data: 'morning:energy:4' },
      ],
      [{ text: '5 🤩 Great', callback_data: 'morning:energy:5' }],
    ],
  }
}

export default async function actionMicroGoalsGenerate(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  _rawText: string,
  _msg: Message,
  skipEnergyLevels: boolean = true,
) {
  const chatId = chat.id
  const userId = String(from?.id || chatId)

  // 1) Ensure we have today's energy first; if not, prompt and store pending state
  if (!skipEnergyLevels) {
    try {
      const session = getSession(userId)
      const ctx = session?.conversationState?.context || {}
      const energyValue = ctx?.morningEnergy as number | undefined
      const energyDate = ctx?.morningEnergyDate as string | undefined
      const today = todayStamp()

      const hasTodayEnergy =
        typeof energyValue === 'number' &&
        energyValue >= 1 &&
        energyValue <= 5 &&
        energyDate === today

      if (!hasTodayEnergy) {
        // Set conversation state indicating we are awaiting morning energy
        setSession({
          ...(session || { userId }),
          accessToken: session?.accessToken || '',
          idToken: session?.idToken,
          refreshToken: session?.refreshToken,
          expiresAt: session?.expiresAt,
          conversationState: {
            lastAction: 'morning_energy',
            flowId: 'morning_energy',
            ...(session?.conversationState || {}),
            context: {
              ...(ctx || {}),
            },
            lastUpdatedAt: Math.floor(Date.now() / 1000),
          },
        })

        const header = '<b>Before we plan today</b>\nHow’s your energy and wellbeing right now?'
        await bot.sendMessage(chatId, header, {
          parse_mode: 'HTML',
          reply_markup: buildMorningEnergyKeyboard(),
        })
        return true
      }
    } catch (e) {
      // Non-blocking; if session read fails, we simply proceed to generation
    }
  }

  // 2) Generate micro goals now that energy has been captured (or if not required)
  try {
    const goals = await GoalsService.goalsControllerGenerateMicroGoals()
    const list = (goals || []).slice(0, 3)

    const header = '<b>Here are your 3 micro goals for today.</b>'
    const bullets = list.map((g) => `• ${escapeHtml(g.text || '')}`).join('\n')
    const body = [header, '', bullets].join('\n')

    await bot.sendMessage(chatId, body, { parse_mode: 'HTML' })

    const followUp =
      'I’ll check in with you tonight at 8 PM — you can always journal or send a voice note before then.'

    await bot.sendMessage(chatId, followUp, { parse_mode: 'HTML' })
  } catch (err) {
    console.error(err)
    await bot.sendMessage(
      chatId,
      "Sorry, I could not generate today's micro goals. Please try again later.",
    )
  }

  // 3) Clear temporary morning energy state if active
  try {
    const session = getSession(userId)
    if (session?.conversationState?.lastAction === 'morning_energy') {
      clearConversationSession(userId, session)
    }
  } catch {}

  return true
}
