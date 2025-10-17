import TelegramBot, { Message, SendMessageOptions } from 'node-telegram-bot-api'
import { ProfilesService, UserProfileLifestyleCreateModel } from 'src/generated/backend'
import actionMacroGoal from './actionMacroGoal'
import { getSession, setSession, clearConversationSession } from 'src/lib/sessionStore'

function buildActiveKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '1 🛋️ Very low', callback_data: 'lifestyle:active:1' },
        { text: '2 🚶‍♂️ Light', callback_data: 'lifestyle:active:2' },
      ],
      [
        { text: '3 🏃 Moderate', callback_data: 'lifestyle:active:3' },
        { text: '4 💪 High', callback_data: 'lifestyle:active:4' },
      ],
      [{ text: '5 🔥 Very high', callback_data: 'lifestyle:active:5' }],
    ],
  }
}

function buildEnergyKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '1 😴 Very low', callback_data: 'lifestyle:energy:1' },
        { text: '2 😐 Low', callback_data: 'lifestyle:energy:2' },
      ],
      [
        { text: '3 🙂 Okay', callback_data: 'lifestyle:energy:3' },
        { text: '4 😊 Good', callback_data: 'lifestyle:energy:4' },
      ],
      [{ text: '5 🤩 Great', callback_data: 'lifestyle:energy:5' }],
    ],
  }
}

function setLifestyleState(userId: string, patch: { activeLevel?: number; energyLevel?: number }) {
  const prev = getSession(userId)
  const prevCtx = prev?.conversationState?.context || {}
  setSession({
    ...(prev || { userId }),
    accessToken: prev?.accessToken || '',
    idToken: prev?.idToken,
    refreshToken: prev?.refreshToken,
    expiresAt: prev?.expiresAt,
    conversationState: {
      lastAction: 'lifestyle',
      flowId: 'lifestyle',
      ...(prev?.conversationState || {}),
      context: {
        ...prevCtx,
        lifestyleActive: patch.activeLevel ?? prevCtx.lifestyleActive,
        lifestyleEnergy: patch.energyLevel ?? prevCtx.lifestyleEnergy,
      },
      lastUpdatedAt: Math.floor(Date.now() / 1000),
    },
  })
}

export default async function actionLifestyle(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  _rawText: string,
  msg: Message,
) {
  const chatId = chat.id
  const userId = String(from.id)

  // 1) Skip if lifestyle already exists
  const userProfile = await ProfilesService.profilesControllerMe()
  if (Array.isArray(userProfile.lifestyles) && userProfile.lifestyles.length >= 1) {
    return false
  }

  // 2) Read in-progress selections from session
  const session = getSession(userId)
  const ctx = session?.conversationState?.context || {}
  const activeLevel = ctx?.lifestyleActive as number | undefined
  const energyLevel = ctx?.lifestyleEnergy as number | undefined

  const opts: SendMessageOptions = { parse_mode: 'HTML' }

  // 3) If both values are present, persist and proceed
  if (
    typeof activeLevel === 'number' &&
    activeLevel >= 1 &&
    activeLevel <= 5 &&
    typeof energyLevel === 'number' &&
    energyLevel >= 1 &&
    energyLevel <= 5
  ) {
    const newLifestyle: UserProfileLifestyleCreateModel = {
      activeLevel,
      energyLevel,
    }
    try {
      console.log('sending newLifestyle: ', newLifestyle)
      await ProfilesService.profilesControllerAddLifestyle({ requestBody: newLifestyle })
    } catch (e) {
      console.error(e)
      await bot.sendMessage(chatId, 'Sorry, we could not save your lifestyle. Please try again.')
      return true
    }

    clearConversationSession(userId, session)
    await actionMacroGoal(bot, chat, from, '', msg, true)
    return true
  }

  // 4) If active level missing, prompt for it
  if (!(typeof activeLevel === 'number' && activeLevel >= 1 && activeLevel <= 5)) {
    setLifestyleState(userId, {})
    await bot.sendMessage(chatId, '<b>How active are you currently?</b>', {
      ...opts,
      reply_markup: buildActiveKeyboard(),
    })
    return true
  }

  // 5) Active present, energy missing -> prompt for energy
  setLifestyleState(userId, { activeLevel })
  await bot.sendMessage(chatId, '<b>How’s your energy and wellbeing today?</b>', {
    ...opts,
    reply_markup: buildEnergyKeyboard(),
  })
  return true
}
